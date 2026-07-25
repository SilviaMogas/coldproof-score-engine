import type { Reading } from "../../domain/reading/reading.js";

/** A single message read back from an HCS topic via the mirror node. */
export interface ConsensusMessage {
  /** Consensus sequence number assigned by Hedera. */
  sequenceNumber: number;
  /** Consensus timestamp string, e.g. "1700000000.123456789". */
  consensusTimestamp: string;
  /** Parsed JSON payload of the message (the mirrored reading record). */
  payload: unknown;
}

/**
 * Reads the immutable reading history back from Hedera. Settlement decisions
 * are made ONLY from this data (not the local readings store), so the payout
 * is provably driven by the on-chain log.
 *
 * Best-effort: returns an empty list if the topic is unavailable.
 */
export interface ConsensusReader {
  fetchMessages(): Promise<ConsensusMessage[]>;
}

/** Shape of the reading record mirrored to HCS by {@link HcsConsensusLog}. */
export interface MirroredReading {
  deviceId: Reading["deviceId"];
  seq: Reading["seq"];
  temperatureC: Reading["temperatureC"];
  unit: Reading["unit"];
  ts: Reading["ts"];
  pubKey: Reading["publicKey"];
  sig: Reading["signature"];
  /** ISO timestamp of when the backend received the reading. */
  receivedAt: string;
}
