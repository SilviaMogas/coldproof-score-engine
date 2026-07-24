import type { Reading } from "../../domain/reading/reading.js";

/** The receipt returned after a reading is committed to the consensus log. */
export interface ConsensusReceipt {
  /** The HCS topic the reading was written to. */
  topicId: string;
  /** The topic sequence number assigned at consensus. */
  sequenceNumber: string;
  /** The submitting transaction id (for explorer lookup). */
  transactionId: string;
}

/**
 * Port for appending an authenticated reading to an immutable, ordered
 * consensus log (Hedera Consensus Service). Implemented in infrastructure so
 * the application layer stays independent of the Hedera SDK.
 *
 * Implementations MUST NOT throw: ingestion always persists the reading
 * locally, and publishing to the log is best-effort. A `null` result means the
 * reading was not committed to the log (disabled or a transient failure).
 */
export interface ConsensusLog {
  publish(reading: Reading): Promise<ConsensusReceipt | null>;
}
