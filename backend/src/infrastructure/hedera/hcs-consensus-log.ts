import {
  AccountId,
  Client,
  PrivateKey,
  TopicCreateTransaction,
  TopicMessageSubmitTransaction,
} from "@hashgraph/sdk";
import type {
  ConsensusLog,
  ConsensusReceipt,
} from "../../application/ports/consensus-log.js";
import type { Reading } from "../../domain/reading/reading.js";

/** Minimal logger shape so this adapter can report failures. */
export interface HcsLogger {
  info(obj: unknown, msg?: string): void;
  warn(obj: unknown, msg?: string): void;
  error(obj: unknown, msg?: string): void;
}

export interface HcsConsensusLogOptions {
  network: string;
  operatorId: string;
  operatorKey: string;
  /** Reuse a fixed topic; if omitted, one is created on first publish. */
  topicId?: string;
  memo?: string;
  logger?: HcsLogger;
}

/**
 * Publishes readings to the Hedera Consensus Service, mirroring the standalone
 * gateway PoC: each reading is submitted to a topic as a JSON message and the
 * consensus sequence number / transaction id is returned.
 *
 * The operator key stays on this trusted backend and never touches a device.
 * Publishing is best-effort — failures are logged and surfaced as a `null`
 * receipt so a valid reading is never rejected because Hedera is unavailable.
 */
export class HcsConsensusLog implements ConsensusLog {
  private readonly client: Client;
  private readonly logger?: HcsLogger;
  private readonly memo: string;
  private topicId?: string;
  private topicInit?: Promise<string>;

  constructor(opts: HcsConsensusLogOptions) {
    this.client = clientForNetwork(opts.network);
    this.client.setOperator(
      AccountId.fromString(opts.operatorId),
      PrivateKey.fromStringDer(opts.operatorKey)
    );
    this.topicId = opts.topicId;
    this.memo = opts.memo ?? "coldproof backend readings";
    this.logger = opts.logger;
  }

  async publish(reading: Reading): Promise<ConsensusReceipt | null> {
    try {
      const topicId = await this.ensureTopic();
      const record = {
        deviceId: reading.deviceId,
        seq: reading.seq,
        temperatureC: reading.temperatureC,
        unit: reading.unit,
        ts: reading.ts,
        pubKey: reading.publicKey,
        sig: reading.signature,
        receivedAt: reading.receivedAt.toISOString(),
      };

      const tx = await new TopicMessageSubmitTransaction()
        .setTopicId(topicId)
        .setMessage(JSON.stringify(record))
        .execute(this.client);
      const receipt = await tx.getReceipt(this.client);
      const sequenceNumber = receipt.topicSequenceNumber;
      if (sequenceNumber === null) {
        throw new Error("HCS receipt missing topic sequence number");
      }

      return {
        topicId,
        sequenceNumber: sequenceNumber.toString(),
        transactionId: tx.transactionId.toString(),
      };
    } catch (err) {
      this.logger?.error(
        { err, deviceId: reading.deviceId, seq: reading.seq },
        "failed to submit reading to HCS"
      );
      return null;
    }
  }

  /** Lazily creates the topic on first use when none was configured. */
  private ensureTopic(): Promise<string> {
    if (this.topicId) {
      return Promise.resolve(this.topicId);
    }
    if (!this.topicInit) {
      this.topicInit = (async () => {
        const tx = await new TopicCreateTransaction()
          .setTopicMemo(this.memo)
          .execute(this.client);
        const receipt = await tx.getReceipt(this.client);
        if (receipt.topicId === null) {
          throw new Error("HCS receipt missing topic id");
        }
        const id = receipt.topicId.toString();
        this.topicId = id;
        this.logger?.info({ topicId: id }, "created HCS topic");
        return id;
      })();
    }
    return this.topicInit;
  }
}

function clientForNetwork(network: string): Client {
  switch (network.toLowerCase()) {
    case "mainnet":
      return Client.forMainnet();
    case "previewnet":
      return Client.forPreviewnet();
    case "testnet":
    default:
      return Client.forTestnet();
  }
}
