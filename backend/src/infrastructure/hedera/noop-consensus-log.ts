import type {
  ConsensusLog,
  ConsensusReceipt,
} from "../../application/ports/consensus-log.js";

/**
 * No-op consensus log used when Hedera credentials are not configured (e.g.
 * local development). Readings are still persisted; they are simply not
 * mirrored to HCS.
 */
export class NoopConsensusLog implements ConsensusLog {
  async publish(): Promise<ConsensusReceipt | null> {
    return null;
  }
}
