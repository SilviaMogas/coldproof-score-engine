import {
  Contract,
  JsonRpcProvider,
  Wallet,
  id,
  keccak256,
  toUtf8Bytes,
} from "ethers";
import type {
  ConsensusLog,
  ConsensusReceipt,
} from "../../application/ports/consensus-log.js";
import type { Reading } from "../../domain/reading/reading.js";
import type { Delivery } from "../../domain/delivery/delivery.js";

const SEPOLIA_CHAIN_ID = 11155111;
const ESCROW_ABI = [
  "function recordReading(bytes32 deliveryId,uint32 sequence,int32 temperatureMilliC,uint64 measuredAt,bytes32 readingHash)",
] as const;

export interface ChainLogger {
  info(obj: unknown, msg?: string): void;
  warn(obj: unknown, msg?: string): void;
  error(obj: unknown, msg?: string): void;
}

export interface SepoliaConsensusLogOptions {
  rpcUrl: string;
  oraclePrivateKey: string;
  contractAddress: string;
  logger?: ChainLogger;
}

/** Anchors verified sensor readings to the ColdProof escrow on Sepolia. */
export class SepoliaConsensusLog implements ConsensusLog {
  private readonly provider: JsonRpcProvider;
  private readonly contract: Contract;
  private readonly contractAddress: string;
  private readonly logger?: ChainLogger;
  private networkChecked = false;

  constructor(opts: SepoliaConsensusLogOptions) {
    this.provider = new JsonRpcProvider(opts.rpcUrl, SEPOLIA_CHAIN_ID, {
      staticNetwork: true,
    });
    const signer = new Wallet(opts.oraclePrivateKey, this.provider);
    this.contractAddress = opts.contractAddress;
    this.contract = new Contract(opts.contractAddress, ESCROW_ABI, signer);
    this.logger = opts.logger;
  }

  async publish(
    reading: Reading,
    delivery: Delivery | null
  ): Promise<ConsensusReceipt | null> {
    if (!delivery) {
      this.logger?.info(
        { deviceId: reading.deviceId, seq: reading.seq },
        "reading has no in-transit delivery; skipping Sepolia"
      );
      return null;
    }

    try {
      await this.ensureSepolia();
      if (reading.seq > 0xffffffff) {
        throw new Error("reading sequence exceeds uint32");
      }

      const temperatureMilliC = Math.round(reading.temperatureC * 1000);
      if (temperatureMilliC < -2147483648 || temperatureMilliC > 2147483647) {
        throw new Error("temperature exceeds int32");
      }

      const readingHash = keccak256(
        toUtf8Bytes(
          JSON.stringify({
            deviceId: reading.deviceId,
            seq: reading.seq,
            temperatureC: reading.temperatureC,
            unit: reading.unit,
            ts: reading.ts,
            publicKey: reading.publicKey,
            signature: reading.signature,
          })
        )
      );
      const recordReading = this.contract.getFunction("recordReading");
      const tx = await recordReading(
        id(delivery.id),
        reading.seq,
        temperatureMilliC,
        reading.ts,
        readingHash
      );
      const receipt = await tx.wait();
      if (!receipt) throw new Error("Sepolia transaction was not mined");

      return {
        chainId: SEPOLIA_CHAIN_ID,
        contractAddress: this.contractAddress,
        transactionId: receipt.hash,
        blockNumber: receipt.blockNumber,
        deliveryId: delivery.id,
      };
    } catch (err) {
      this.logger?.error(
        {
          err,
          deliveryId: delivery.id,
          deviceId: reading.deviceId,
          seq: reading.seq,
        },
        "failed to record reading on Sepolia"
      );
      return null;
    }
  }

  private async ensureSepolia(): Promise<void> {
    if (this.networkChecked) return;
    const network = await this.provider.getNetwork();
    if (Number(network.chainId) !== SEPOLIA_CHAIN_ID) {
      throw new Error(
        `expected Sepolia chain ${SEPOLIA_CHAIN_ID}, received ${network.chainId}`
      );
    }
    this.networkChecked = true;
  }
}
