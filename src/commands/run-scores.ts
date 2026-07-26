import { mkdir, readFile, writeFile } from "node:fs/promises";
import { basename, resolve } from "node:path";
import { JsonRpcProvider, Wallet } from "ethers";
import { loadScoreConfig } from "../config.js";
import { changedRecordKeys, buildScoreRecords } from "../ens/score-records.js";
import { EnsV2ScoreReader } from "../ens/score-reader.js";
import { EnsV2ScoreWriter } from "../ens/score-writer.js";
import { adaptCarrierMetrics, type CarrierGraphData } from "../graph/carrier-metrics-adapter.js";
import { endpointIdentifier, GraphClient } from "../graph/graph-client.js";
import { scoreCarrier } from "../scoring/score-engine.js";

interface AuditCarrier {
  carrierId: string; displayName: string; ensName: string; ensProfileUrl: string;
  previousScore?: string; newScore?: number;
  previousGrade?: string; newGrade?: string; metrics?: object; rates?: object;
  dataHash?: string; action: "skipped" | "planned" | "applied" | "error";
  transactionHash?: string; error?: string;
}

export async function runScores(mode: "plan" | "sync"): Promise<void> {
  const config = await loadScoreConfig();
  const runTimestamp = new Date().toISOString();
  if (!config.sepoliaRpcUrl) throw new Error("SEPOLIA_RPC_URL is required to read ENS");
  if (mode === "sync" && !config.syncConfirm) {
    throw new Error("Refusing sync: set SCORE_SYNC_CONFIRM=true explicitly");
  }
  if (mode === "sync" && !config.ensAdminPrivateKey) {
    throw new Error("ENS_ADMIN_PRIVATE_KEY is required for sync");
  }
  const provider = new JsonRpcProvider(config.sepoliaRpcUrl);
  const network = await provider.getNetwork();
  if (network.chainId !== 11155111n) throw new Error(`Expected Sepolia chain 11155111, got ${network.chainId}`);

  let source: CarrierGraphData;
  let graphIdentifier: string;
  if (config.graphFixtureMode) {
    const fixturePath = resolve(config.graphFixtureFile);
    const fixture = JSON.parse(await readFile(fixturePath, "utf8")) as
      CarrierGraphData | { data: CarrierGraphData };
    source = "data" in fixture ? fixture.data : fixture;
    graphIdentifier = `fixture:${basename(fixturePath)}`;
  } else {
    if (!config.graphEndpoint) throw new Error("GRAPH_ENDPOINT is required unless GRAPH_FIXTURE_MODE=true");
    const query = await readFile(resolve("queries/carrier-metrics.graphql"), "utf8");
    source = await new GraphClient({
      endpoint: config.graphEndpoint, apiKey: config.graphApiKey,
      apiKeyHeader: config.graphApiKeyHeader,
      allowPartialErrors: config.graphAllowPartialErrors,
    }).query<CarrierGraphData>(query);
    graphIdentifier = endpointIdentifier(config.graphEndpoint);
  }

  const metricsList = adaptCarrierMetrics(source, config.carrierMap, config.ensParentName);
  const reader = new EnsV2ScoreReader(provider);
  let writer: EnsV2ScoreWriter | undefined;
  if (mode === "sync") {
    const wallet = new Wallet(config.ensAdminPrivateKey!, provider);
    if (wallet.address.toLowerCase() !== config.ensAdminAddress.toLowerCase()) {
      throw new Error("ENS_ADMIN_PRIVATE_KEY does not correspond to ENS_ADMIN_ADDRESS");
    }
    writer = new EnsV2ScoreWriter(wallet);
  }
  const audit: AuditCarrier[] = [];
  for (const metrics of metricsList) {
    try {
      const result = scoreCarrier(metrics, config.model);
      const current = await reader.read(metrics.ensName);
      const records = buildScoreRecords(metrics, result, runTimestamp);
      const keys = changedRecordKeys(current.records, records, config.scoreMinChange);
      const item: AuditCarrier = {
        carrierId: metrics.carrierId, ensName: metrics.ensName,
        displayName: metrics.displayName, ensProfileUrl: metrics.ensProfileUrl,
        previousScore: current.records["com.coldproof.score"], newScore: result.score,
        previousGrade: current.records["com.coldproof.grade"], newGrade: result.grade,
        metrics, rates: {
          complianceRate: result.complianceRate, onTimeRate: result.onTimeRate,
          completionRate: result.completionRate,
        },
        dataHash: result.dataHash, action: keys.length === 0 ? "skipped" : "planned",
      };
      if (writer && keys.length) {
        await writer.assertPermission(metrics.ensName, current.resolver, records, keys);
        const receipt = await writer.write(metrics.ensName, current.resolver, records, keys);
        item.action = "applied";
        item.transactionHash = receipt.hash;
      }
      audit.push(item);
      console.log(`${item.action.toUpperCase()} ${metrics.carrierId} | ${metrics.displayName} | ${metrics.ensName} | ${metrics.ensProfileUrl} | ${item.previousScore ?? "unset"} -> ${result.score} (${result.grade})`);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      audit.push({
        carrierId: metrics.carrierId, displayName: metrics.displayName,
        ensName: metrics.ensName, ensProfileUrl: metrics.ensProfileUrl,
        action: "error", error: message,
      });
      if (mode === "sync") {
        await saveReport(runTimestamp, config.model.scoreVersion, graphIdentifier, source, audit);
        throw error;
      }
      console.error(`ERROR ${metrics.ensName}: ${message}`);
    }
  }
  const path = await saveReport(runTimestamp, config.model.scoreVersion, graphIdentifier, source, audit);
  console.log(`Audit report: ${path}`);
  if (audit.some((item) => item.action === "error")) process.exitCode = 1;
}

async function saveReport(
  timestamp: string, version: string, endpoint: string, source: CarrierGraphData,
  carriers: AuditCarrier[],
): Promise<string> {
  await mkdir(resolve("reports"), { recursive: true });
  const path = resolve("reports", `score-sync-${timestamp.replace(/[:.]/g, "-")}.json`);
  const report = {
    runTimestamp: timestamp, scoreModelVersion: version, graphEndpointIdentifier: endpoint,
    graphBlockNumber: source._meta?.block?.number, carriers,
  };
  await writeFile(path, `${JSON.stringify(report, null, 2)}\n`, "utf8");
  return path;
}
