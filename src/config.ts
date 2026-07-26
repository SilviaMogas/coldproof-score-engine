import "dotenv/config";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import type { ScoreModel } from "./scoring/types.js";

const boolean = (value: string | undefined, fallback = false): boolean =>
  value === undefined ? fallback : value.toLowerCase() === "true";

export interface ScoreConfig {
  graphEndpoint?: string; graphApiKey?: string; graphApiKeyHeader?: string;
  graphFixtureMode: boolean; graphFixtureFile: string; graphAllowPartialErrors: boolean;
  ensAdminAddress: string; ensAdminPrivateKey?: string; ensParentName: string;
  sepoliaRpcUrl?: string; scoreMinChange: number; syncConfirm: boolean;
  model: ScoreModel; carrierMap: Record<string, string>;
}

export async function loadScoreConfig(): Promise<ScoreConfig> {
  const model = JSON.parse(await readFile(resolve("config/score-model.json"), "utf8")) as ScoreModel;
  const carrierMap = JSON.parse(await readFile(resolve("config/carrier-ens-map.json"), "utf8")) as Record<string, string>;
  const scoreVersion = process.env.SCORE_VERSION ?? model.scoreVersion;
  if (scoreVersion !== model.scoreVersion) throw new Error("SCORE_VERSION does not match score-model.json");
  const minChange = Number(process.env.SCORE_MIN_CHANGE ?? "1");
  if (!Number.isFinite(minChange) || minChange < 0) throw new Error("SCORE_MIN_CHANGE must be non-negative");
  return {
    graphEndpoint: process.env.GRAPH_ENDPOINT,
    graphApiKey: process.env.GRAPH_API_KEY,
    graphApiKeyHeader: process.env.GRAPH_API_KEY_HEADER,
    graphFixtureMode: boolean(process.env.GRAPH_FIXTURE_MODE),
    graphFixtureFile: process.env.GRAPH_FIXTURE_FILE ?? "./fixtures/carrier-metrics.json",
    graphAllowPartialErrors: boolean(process.env.GRAPH_ALLOW_PARTIAL_ERRORS),
    ensAdminAddress: process.env.ENS_ADMIN_ADDRESS ?? "0x16a30d989a440c1303ddb33a38b730e96528eea9",
    ensAdminPrivateKey: process.env.ENS_ADMIN_PRIVATE_KEY,
    ensParentName: process.env.ENS_PARENT_NAME ?? "coldproof.eth",
    sepoliaRpcUrl: process.env.SEPOLIA_RPC_URL,
    scoreMinChange: minChange,
    syncConfirm: boolean(process.env.SCORE_SYNC_CONFIRM),
    model, carrierMap,
  };
}
