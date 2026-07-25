import type { Reading } from "../../domain/reading/reading.js";
import type { Delivery } from "../../domain/delivery/delivery.js";

/** The receipt returned after a reading is committed to the consensus log. */
export interface ConsensusReceipt {
  chainId: number;
  contractAddress: string;
  transactionId: string;
  blockNumber: number;
  deliveryId: string;
}

/**
 * Port for appending an authenticated reading to an immutable, ordered
 * consensus log. Implemented in infrastructure so the application stays
 * independent of a specific chain client.
 *
 * Implementations MUST NOT throw: ingestion always persists the reading
 * locally, and publishing to the log is best-effort. A `null` result means the
 * reading was not committed to the log (disabled or a transient failure).
 */
export interface ConsensusLog {
  publish(
    reading: Reading,
    delivery: Delivery | null
  ): Promise<ConsensusReceipt | null>;
}
