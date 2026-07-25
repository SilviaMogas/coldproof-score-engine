import type { Env } from "../config/env.js";
import type { EscrowGateway } from "../application/ports/escrow-gateway.js";
import type { SettlementConfig } from "../application/settlement/settle-delivery.js";
import { NoopEscrowGateway } from "../infrastructure/ethereum/noop-escrow-gateway.js";
import { SepoliaEscrowGateway } from "../infrastructure/ethereum/sepolia-escrow-gateway.js";

export interface SettlementServices {
  escrow: EscrowGateway;
  config: SettlementConfig;
}

interface SettlementLogger {
  warn(obj: unknown, msg?: string): void;
}

/**
 * Builds settlement services backed by ColdProofEscrow on Sepolia.
 */
export function createSettlement(
  env: Env,
  logger?: SettlementLogger
): SettlementServices {
  const enabled = Boolean(
    env.SEPOLIA_RPC_URL &&
      env.SEPOLIA_ORACLE_PRIVATE_KEY &&
      env.SEPOLIA_ESCROW_ADDRESS
  );
  if (!enabled) {
    logger?.warn({}, "Sepolia settlement configuration is incomplete");
  }
  return {
    escrow: enabled
      ? new SepoliaEscrowGateway(
          env.SEPOLIA_RPC_URL as string,
          env.SEPOLIA_ORACLE_PRIVATE_KEY as string,
          env.SEPOLIA_ESCROW_ADDRESS as string
        )
      : new NoopEscrowGateway(),
    config: {
      enabled,
      minTempC: env.TEMP_MIN_C,
      maxTempC: env.TEMP_MAX_C,
      requiredReadings: env.ESCROW_REQUIRED_READINGS,
    },
  };
}
