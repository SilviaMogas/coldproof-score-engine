import type { Env } from "../config/env.js";
import type { ConsensusReader } from "../application/ports/consensus-reader.js";
import type { EscrowGateway } from "../application/ports/escrow-gateway.js";
import type { SettlementConfig } from "../application/settlement/settle-delivery.js";
import { HcsConsensusReader } from "../infrastructure/hedera/hcs-consensus-reader.js";
import { HederaEscrowGateway } from "../infrastructure/hedera/hedera-escrow-gateway.js";
import { NoopConsensusReader } from "../infrastructure/hedera/noop-consensus-reader.js";
import { NoopEscrowGateway } from "../infrastructure/hedera/noop-escrow-gateway.js";
import { SepoliaConsensusReader } from "../infrastructure/ethereum/sepolia-consensus-reader.js";
import { SepoliaEscrowGateway } from "../infrastructure/ethereum/sepolia-escrow-gateway.js";
import { evmAddressToAccountId } from "../infrastructure/ethereum/account-id.js";

/** The collaborators the settlement use cases depend on. */
export interface SettlementServices {
  reader: ConsensusReader;
  escrow: EscrowGateway;
  config: SettlementConfig;
}

interface SettlementLogger {
  warn(obj: unknown, msg?: string): void;
}

/**
 * Builds the settlement services. Settlement is enabled only when the Hedera
 * operator (escrow) account, the topic to read back, and the shipper refund
 * account are all configured; otherwise a disabled, no-op set is returned so
 * the backend still runs in local development.
 */
export function createSettlement(
  env: Env,
  logger?: SettlementLogger
): SettlementServices {
  if (env.BLOCKCHAIN_PROVIDER === "sepolia") {
    const enabled = Boolean(
      env.SEPOLIA_RPC_URL &&
        env.SEPOLIA_ORACLE_PRIVATE_KEY &&
        env.SEPOLIA_CONSENSUS_ADDRESS &&
        env.SEPOLIA_SHIPPER_ADDRESS
    );
    const config: SettlementConfig = {
      enabled,
      minTempC: env.TEMP_MIN_C,
      maxTempC: env.TEMP_MAX_C,
      shipperAccountId: env.SEPOLIA_SHIPPER_ADDRESS
        ? evmAddressToAccountId(env.SEPOLIA_SHIPPER_ADDRESS)
        : undefined,
    };
    if (!enabled) {
      logger?.warn({}, "Sepolia settlement configuration is incomplete");
      return {
        reader: new NoopConsensusReader(),
        escrow: new NoopEscrowGateway(),
        config,
      };
    }
    return {
      reader: new SepoliaConsensusReader({
        rpcUrl: env.SEPOLIA_RPC_URL as string,
        contractAddress: env.SEPOLIA_CONSENSUS_ADDRESS as string,
        startBlock: env.SEPOLIA_CONSENSUS_START_BLOCK,
        logger,
      }),
      escrow: new SepoliaEscrowGateway(
        env.SEPOLIA_RPC_URL as string,
        env.SEPOLIA_ORACLE_PRIVATE_KEY as string
      ),
      config,
    };
  }

  const enabled = Boolean(
    env.HEDERA_OPERATOR_ID &&
      env.HEDERA_OPERATOR_KEY &&
      env.HEDERA_TOPIC_ID &&
      env.SHIPPER_ACCOUNT_ID
  );

  const config: SettlementConfig = {
    enabled,
    minTempC: env.TEMP_MIN_C,
    maxTempC: env.TEMP_MAX_C,
    shipperAccountId: env.SHIPPER_ACCOUNT_ID,
  };

  if (!enabled) {
    logger?.warn(
      {},
      "settlement disabled; needs HEDERA_OPERATOR_ID, HEDERA_OPERATOR_KEY, HEDERA_TOPIC_ID and SHIPPER_ACCOUNT_ID"
    );
    return {
      reader: new NoopConsensusReader(),
      escrow: new NoopEscrowGateway(),
      config,
    };
  }

  return {
    reader: new HcsConsensusReader({
      network: env.HEDERA_NETWORK,
      topicId: env.HEDERA_TOPIC_ID as string,
      logger,
    }),
    escrow: new HederaEscrowGateway({
      network: env.HEDERA_NETWORK,
      operatorId: env.HEDERA_OPERATOR_ID as string,
      operatorKey: env.HEDERA_OPERATOR_KEY as string,
    }),
    config,
  };
}
