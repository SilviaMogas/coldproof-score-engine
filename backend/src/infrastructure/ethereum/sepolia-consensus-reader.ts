import {
  Contract,
  JsonRpcProvider,
  type EventLog,
  type Log,
} from "ethers";
import type {
  ConsensusMessage,
  ConsensusReader,
  MirroredReading,
} from "../../application/ports/consensus-reader.js";

const SEPOLIA_CHAIN_ID = 11155111;
const ABI = [
  "event ReadingRecorded(uint256 indexed logSequence,string deviceId,uint32 sensorSequence,int32 temperatureMilliC,string unit,uint64 measuredAt,string publicKey,string signature,uint64 receivedAtMs,bytes32 readingHash)",
] as const;

export interface SepoliaConsensusReaderOptions {
  rpcUrl: string;
  contractAddress: string;
  startBlock: number;
  logger?: { warn(obj: unknown, msg?: string): void };
}

/** Reads the ordered ReadingRecorded history, equivalent to an HCS mirror node. */
export class SepoliaConsensusReader implements ConsensusReader {
  private readonly provider: JsonRpcProvider;
  private readonly contract: Contract;
  private readonly startBlock: number;
  private readonly logger?: { warn(obj: unknown, msg?: string): void };

  constructor(opts: SepoliaConsensusReaderOptions) {
    this.provider = new JsonRpcProvider(opts.rpcUrl, SEPOLIA_CHAIN_ID, {
      staticNetwork: true,
    });
    this.contract = new Contract(opts.contractAddress, ABI, this.provider);
    this.startBlock = opts.startBlock;
    this.logger = opts.logger;
  }

  async fetchMessages(): Promise<ConsensusMessage[]> {
    try {
      // Alchemy's free tier limits eth_getLogs to small block ranges. Paging
      // also keeps this equivalent to the paginated Hedera mirror-node reader.
      const latestBlock = await this.provider.getBlockNumber();
      const events: Array<EventLog | Log> = [];
      for (let fromBlock = this.startBlock; fromBlock <= latestBlock; fromBlock += 10) {
        const toBlock = Math.min(fromBlock + 9, latestBlock);
        events.push(
          ...(await this.contract.queryFilter(
            "ReadingRecorded",
            fromBlock,
            toBlock
          ))
        );
      }
      return events
        .filter((event): event is typeof event & { args: Record<string, unknown> } =>
          "args" in event
        )
        .map((event) => {
          const args = event.args as unknown as {
            logSequence: bigint;
            deviceId: string;
            sensorSequence: bigint;
            temperatureMilliC: bigint;
            unit: string;
            measuredAt: bigint;
            publicKey: string;
            signature: string;
            receivedAtMs: bigint;
          };
          const payload: MirroredReading = {
            deviceId: args.deviceId,
            seq: Number(args.sensorSequence),
            temperatureC: Number(args.temperatureMilliC) / 1000,
            unit: args.unit,
            ts: Number(args.measuredAt),
            pubKey: args.publicKey,
            sig: args.signature,
            receivedAt: new Date(Number(args.receivedAtMs)).toISOString(),
          };
          return {
            sequenceNumber: Number(args.logSequence),
            consensusTimestamp: args.receivedAtMs.toString(),
            payload,
          };
        });
    } catch (err) {
      this.logger?.warn({ err }, "failed to read Sepolia consensus events");
      return [];
    }
  }
}
