import {
  Contract,
  JsonRpcProvider,
  Wallet,
  keccak256,
  toUtf8Bytes,
} from "ethers";
import type {
  ConsensusLog,
  ConsensusReceipt,
} from "../../application/ports/consensus-log.js";
import type { Reading } from "../../domain/reading/reading.js";

const SEPOLIA_CHAIN_ID = 11155111;
const ABI = [
  "function recordReading(string deviceId,uint32 sensorSequence,int32 temperatureMilliC,string unit,uint64 measuredAt,string publicKey,string signature,uint64 receivedAtMs,bytes32 readingHash)",
  "event ReadingRecorded(uint256 indexed logSequence,string deviceId,uint32 sensorSequence,int32 temperatureMilliC,string unit,uint64 measuredAt,string publicKey,string signature,uint64 receivedAtMs,bytes32 readingHash)",
] as const;

export interface SepoliaLogger {
  info(obj: unknown, msg?: string): void;
  warn(obj: unknown, msg?: string): void;
  error(obj: unknown, msg?: string): void;
}

export interface SepoliaConsensusLogOptions {
  rpcUrl: string;
  oraclePrivateKey: string;
  contractAddress: string;
  logger?: SepoliaLogger;
}

/** Sepolia event-log adapter implementing the same port as HCS. */
export class SepoliaConsensusLog implements ConsensusLog {
  private readonly contract: Contract;
  private readonly contractAddress: string;
  private readonly logger?: SepoliaLogger;

  constructor(opts: SepoliaConsensusLogOptions) {
    const provider = new JsonRpcProvider(opts.rpcUrl, SEPOLIA_CHAIN_ID, {
      staticNetwork: true,
    });
    this.contract = new Contract(
      opts.contractAddress,
      ABI,
      new Wallet(opts.oraclePrivateKey, provider)
    );
    this.contractAddress = opts.contractAddress;
    this.logger = opts.logger;
  }

  async publish(reading: Reading): Promise<ConsensusReceipt | null> {
    try {
      if (reading.seq > 0xffffffff) {
        throw new Error("reading sequence exceeds uint32");
      }
      const temperatureMilliC = Math.round(reading.temperatureC * 1000);
      if (temperatureMilliC < -2147483648 || temperatureMilliC > 2147483647) {
        throw new Error("temperature exceeds int32");
      }
      const canonical = JSON.stringify({
        deviceId: reading.deviceId,
        seq: reading.seq,
        temperatureC: reading.temperatureC,
        unit: reading.unit,
        ts: reading.ts,
        pubKey: reading.publicKey,
        sig: reading.signature,
        receivedAt: reading.receivedAt.toISOString(),
      });
      const tx = await this.contract.getFunction("recordReading")(
        reading.deviceId,
        reading.seq,
        temperatureMilliC,
        reading.unit,
        reading.ts,
        reading.publicKey,
        reading.signature,
        reading.receivedAt.getTime(),
        keccak256(toUtf8Bytes(canonical))
      );
      const receipt = await tx.wait();
      if (!receipt) throw new Error("Sepolia transaction was not mined");
      const event = receipt.logs
        .map((log: { topics: readonly string[]; data: string }) => {
          try {
            return this.contract.interface.parseLog(log);
          } catch {
            return null;
          }
        })
        .find((parsed: { name: string } | null) => parsed?.name === "ReadingRecorded");
      return {
        topicId: this.contractAddress,
        sequenceNumber: event ? event.args.logSequence.toString() : "0",
        transactionId: receipt.hash,
      };
    } catch (err) {
      this.logger?.error(
        { err, deviceId: reading.deviceId, seq: reading.seq },
        "failed to submit reading to Sepolia"
      );
      return null;
    }
  }
}
