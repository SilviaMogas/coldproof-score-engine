import type {
  ConsensusMessage,
  ConsensusReader,
} from "../../application/ports/consensus-reader.js";

/**
 * No-op consensus reader used when settlement is not configured. Returns no
 * messages, so settlement is skipped rather than making an unverified payout.
 */
export class NoopConsensusReader implements ConsensusReader {
  async fetchMessages(): Promise<ConsensusMessage[]> {
    return [];
  }
}
