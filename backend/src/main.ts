import { loadEnv } from "./config/env.js";
import { createLogger } from "./shared/logger.js";
import { createRepositories } from "./composition/repositories.js";
import { createUseCases } from "./composition/use-cases.js";
import { CognitoTokenVerifier } from "./infrastructure/auth/cognito-token-verifier.js";
import { Ed25519SignatureVerifier } from "./infrastructure/crypto/ed25519-signature-verifier.js";
import { buildServer } from "./interface/http/server.js";

/**
 * Composition root: build every concrete dependency once and wire the layers
 * together, then start the HTTP server.
 */
async function main(): Promise<void> {
  const env = loadEnv();
  const logger = createLogger({ level: env.LOG_LEVEL, pretty: env.LOG_PRETTY });

  const repositories = createRepositories(env);
  logger.info({ persistence: env.PERSISTENCE }, "repositories ready");

  const useCases = createUseCases(repositories, new Ed25519SignatureVerifier());
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
  });

  try {
    await app.listen({ host: env.HOST, port: env.PORT });
  } catch (err) {
    logger.error({ err }, "failed to start server");
    process.exit(1);
  }
}

void main();
