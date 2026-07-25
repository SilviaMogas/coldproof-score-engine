import type {
  ConsensusLog,
  ConsensusReceipt,
} from "../../application/ports/consensus-log.js";

/** Used when Sepolia is disabled and in tests. */
export class NoopConsensusLog implements ConsensusLog {
  async publish(): Promise<ConsensusReceipt | null> {
    return null;
  }
}
