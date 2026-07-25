import type { Env } from "../config/env.js";
import type { ConsensusLog } from "../application/ports/consensus-log.js";
import {
  SepoliaConsensusLog,
  type ChainLogger,
} from "../infrastructure/ethereum/sepolia-consensus-log.js";
import { NoopConsensusLog } from "../infrastructure/ethereum/noop-consensus-log.js";

/** Builds the Sepolia adapter or a local no-op when it is not configured. */
export function createConsensusLog(
  env: Env,
  logger?: ChainLogger
): ConsensusLog {
  if (
    !env.SEPOLIA_RPC_URL ||
    !env.SEPOLIA_ORACLE_PRIVATE_KEY ||
    !env.SEPOLIA_ESCROW_ADDRESS
  ) {
    logger?.warn(
      {},
      "Sepolia configuration not set; readings will not be mirrored on-chain"
    );
    return new NoopConsensusLog();
  }

  return new SepoliaConsensusLog({
    rpcUrl: env.SEPOLIA_RPC_URL,
    oraclePrivateKey: env.SEPOLIA_ORACLE_PRIVATE_KEY,
    contractAddress: env.SEPOLIA_ESCROW_ADDRESS,
    logger,
  });
}
