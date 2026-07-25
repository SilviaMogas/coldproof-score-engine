import type {
  ConsensusMessage,
  ConsensusReader,
} from "../../application/ports/consensus-reader.js";

/** Minimal logger shape so this adapter can report failures. */
export interface MirrorLogger {
  warn(obj: unknown, msg?: string): void;
}

export interface HcsConsensusReaderOptions {
  network: string;
  topicId: string;
  /** Max messages to fetch per request page (default 100). */
  pageLimit?: number;
  logger?: MirrorLogger;
}

interface MirrorMessage {
  sequence_number: number;
  consensus_timestamp: string;
  message: string; // base64
}

interface MirrorResponse {
  messages?: MirrorMessage[];
  links?: { next?: string | null };
}

/**
 * Reads a topic's full, ordered message history from the Hedera mirror node
 * REST API. Follows pagination links so the whole cold-chain log is returned.
 *
 * Best-effort: on any network/parse error it returns whatever it has gathered
 * so far (possibly empty), so settlement can still make a conservative call.
 */
export class HcsConsensusReader implements ConsensusReader {
  private readonly baseUrl: string;
  private readonly topicId: string;
  private readonly pageLimit: number;
  private readonly logger?: MirrorLogger;

  constructor(opts: HcsConsensusReaderOptions) {
    this.baseUrl = mirrorNodeBaseUrl(opts.network);
    this.topicId = opts.topicId;
    this.pageLimit = opts.pageLimit ?? 100;
    this.logger = opts.logger;
  }

  async fetchMessages(): Promise<ConsensusMessage[]> {
    const results: ConsensusMessage[] = [];
    let path: string | null =
      `/api/v1/topics/${this.topicId}/messages?limit=${this.pageLimit}&order=asc`;

    try {
      while (path) {
        const res = await fetch(`${this.baseUrl}${path}`);
        if (!res.ok) {
          this.logger?.warn(
            { topicId: this.topicId, status: res.status },
            "mirror node returned a non-OK status"
          );
          break;
        }
        const body = (await res.json()) as MirrorResponse;
        for (const m of body.messages ?? []) {
          results.push(toConsensusMessage(m));
        }
        path = body.links?.next ?? null;
      }
    } catch (err) {
      this.logger?.warn(
        { err, topicId: this.topicId },
        "failed to read topic messages from mirror node"
      );
    }

    return results;
  }
}

function toConsensusMessage(m: MirrorMessage): ConsensusMessage {
  const decoded = Buffer.from(m.message, "base64").toString("utf8");
  let payload: unknown;
  try {
    payload = JSON.parse(decoded);
  } catch {
    payload = { raw: decoded };
  }
  return {
    sequenceNumber: m.sequence_number,
    consensusTimestamp: m.consensus_timestamp,
    payload,
  };
}

export function mirrorNodeBaseUrl(network: string): string {
  switch (network.toLowerCase()) {
    case "mainnet":
      return "https://mainnet-public.mirrornode.hedera.com";
    case "previewnet":
      return "https://previewnet.mirrornode.hedera.com";
    case "testnet":
    default:
      return "https://testnet.mirrornode.hedera.com";
  }
}
