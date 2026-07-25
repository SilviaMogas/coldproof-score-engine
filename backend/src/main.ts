import { loadEnv } from "./config/env.js";
import { createLogger } from "./shared/logger.js";
import { createRepositories } from "./composition/repositories.js";
import { createConsensusLog } from "./composition/consensus-log.js";
import { createCommandSigner } from "./composition/command-signer.js";
import { createSettlement } from "./composition/settlement.js";
import { createUseCases } from "./composition/use-cases.js";
import { CognitoTokenVerifier } from "./infrastructure/auth/cognito-token-verifier.js";
import { Ed25519SignatureVerifier } from "./infrastructure/crypto/ed25519-signature-verifier.js";
import { buildServer } from "./interface/http/server.js";
import { Wallet } from "ethers";

/**
 * Composition root: build every concrete dependency once and wire the layers
 * together, then start the HTTP server.
 */
async function main(): Promise<void> {
  const env = loadEnv();
  const logger = createLogger({ level: env.LOG_LEVEL, pretty: env.LOG_PRETTY });

  const repositories = createRepositories(env);
  logger.info({ persistence: env.PERSISTENCE }, "repositories ready");

  const consensusLog = createConsensusLog(env, logger);
  const commandSigner = createCommandSigner(env, logger);
  logger.info(
    { unlockPublicKey: commandSigner.publicKeyHex },
    "unlock command signer ready"
  );

  const settlement = createSettlement(env, logger);
  logger.info(
    {
      provider: env.BLOCKCHAIN_PROVIDER,
      enabled: settlement.config.enabled,
      escrowAccount: settlement.config.enabled
        ? env.BLOCKCHAIN_PROVIDER === "hedera"
          ? env.HEDERA_OPERATOR_ID
          : "configured Sepolia oracle wallet"
        : null,
      shipperAccount: settlement.config.shipperAccountId ?? null,
    },
    "escrow settlement ready"
  );

  const useCases = createUseCases(
    repositories,
    new Ed25519SignatureVerifier(),
    consensusLog,
    commandSigner,
    {
      minTempC: env.TEMP_MIN_C,
      maxTempC: env.TEMP_MAX_C,
      ttlSeconds: env.UNLOCK_TTL_SECONDS,
    },
    settlement
  );
  const verifier = new CognitoTokenVerifier({
    userPoolId: env.COGNITO_USER_POOL_ID,
    clientId: env.COGNITO_CLIENT_ID,
    tokenUse: env.COGNITO_TOKEN_USE,
  });

  const app = await buildServer({
    logger,
    corsOrigin: env.CORS_ORIGIN,
    verifier,
    useCases,
    settlementEnabled: settlement.config.enabled,
    blockchainProvider: env.BLOCKCHAIN_PROVIDER,
    currency: env.BLOCKCHAIN_PROVIDER === "hedera" ? "HBAR" : "ETH",
    chainId: env.BLOCKCHAIN_PROVIDER === "sepolia" ? 11155111 : null,
    escrowAccount:
      env.BLOCKCHAIN_PROVIDER === "sepolia" &&
      env.SEPOLIA_ORACLE_PRIVATE_KEY
        ? new Wallet(env.SEPOLIA_ORACLE_PRIVATE_KEY).address
        : env.HEDERA_OPERATOR_ID ?? null,
  });

  try {
    await app.listen({ host: env.HOST, port: env.PORT });
  } catch (err) {
    logger.error({ err }, "failed to start server");
    process.exit(1);
  }
}

void main();
