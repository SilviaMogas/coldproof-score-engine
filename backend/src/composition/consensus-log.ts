import type { Env } from "../config/env.js";
import type { ConsensusLog } from "../application/ports/consensus-log.js";
import {
  HcsConsensusLog,
  type HcsLogger,
} from "../infrastructure/hedera/hcs-consensus-log.js";
import { NoopConsensusLog } from "../infrastructure/hedera/noop-consensus-log.js";
import { SepoliaConsensusLog } from "../infrastructure/ethereum/sepolia-consensus-log.js";

/**
 * Builds the consensus log adapter. When Hedera operator credentials are
 * configured, readings are mirrored to HCS; otherwise a no-op log is used so
 * the backend still runs in local development.
 */
export function createConsensusLog(env: Env, logger?: HcsLogger): ConsensusLog {
  if (env.BLOCKCHAIN_PROVIDER === "sepolia") {
    if (
      !env.SEPOLIA_RPC_URL ||
      !env.SEPOLIA_ORACLE_PRIVATE_KEY ||
      !env.SEPOLIA_CONSENSUS_ADDRESS
    ) {
      logger?.warn(
        {},
        "Sepolia configuration not set; readings will not be mirrored"
      );
      return new NoopConsensusLog();
    }
    return new SepoliaConsensusLog({
      rpcUrl: env.SEPOLIA_RPC_URL,
      oraclePrivateKey: env.SEPOLIA_ORACLE_PRIVATE_KEY,
      contractAddress: env.SEPOLIA_CONSENSUS_ADDRESS,
      logger,
    });
  }

  if (!env.HEDERA_OPERATOR_ID || !env.HEDERA_OPERATOR_KEY) {
    logger?.warn(
      {},
      "Hedera credentials not set; readings will not be mirrored to HCS"
    );
    return new NoopConsensusLog();
  }

  return new HcsConsensusLog({
    network: env.HEDERA_NETWORK,
    operatorId: env.HEDERA_OPERATOR_ID,
    operatorKey: env.HEDERA_OPERATOR_KEY,
    topicId: env.HEDERA_TOPIC_ID,
    logger,
  });
}
