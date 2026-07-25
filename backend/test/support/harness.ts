import type { FastifyInstance } from "fastify";
import type {
  AuthenticatedUser,
  TokenVerifier,
} from "../../src/application/ports/token-verifier.js";
import { UnauthorizedError } from "../../src/shared/errors.js";
import { createUseCases } from "../../src/composition/use-cases.js";
import type { Repositories } from "../../src/composition/repositories.js";
import { Ed25519SignatureVerifier } from "../../src/infrastructure/crypto/ed25519-signature-verifier.js";
import { Ed25519CommandSigner } from "../../src/infrastructure/crypto/ed25519-command-signer.js";
import { NoopConsensusLog } from "../../src/infrastructure/hedera/noop-consensus-log.js";
import { InMemoryDeviceRepository } from "../../src/infrastructure/persistence/in-memory-device-repository.js";
import { InMemoryCarrierRepository } from "../../src/infrastructure/persistence/in-memory-carrier-repository.js";
import { InMemoryDeliveryRepository } from "../../src/infrastructure/persistence/in-memory-delivery-repository.js";
import { InMemoryReadingRepository } from "../../src/infrastructure/persistence/in-memory-reading-repository.js";
import { createLogger } from "../../src/shared/logger.js";
import { buildServer } from "../../src/interface/http/server.js";

/** The bearer token the stub verifier accepts for backoffice (auth-gated) routes. */
export const TEST_TOKEN = "test-token";

const testUser: AuthenticatedUser = {
  sub: "test-user",
  username: "tester",
  scopes: [],
  groups: ["admin"],
};

/** Accepts only TEST_TOKEN, so tests need no real Cognito integration. */
class StubTokenVerifier implements TokenVerifier {
  async verify(token: string): Promise<AuthenticatedUser> {
    if (token !== TEST_TOKEN) {
      throw new UnauthorizedError("invalid test token");
    }
    return testUser;
  }
}

/**
 * Builds an in-process server wired with in-memory repositories, the real
 * Ed25519 signature verifier, a no-op consensus log and a stub token verifier.
 * Drive it with `app.inject(...)` — no network port is opened.
 */
export async function buildTestServer(): Promise<FastifyInstance> {
  const repos: Repositories = {
    devices: new InMemoryDeviceRepository(),
    carriers: new InMemoryCarrierRepository(),
    deliveries: new InMemoryDeliveryRepository(),
    readings: new InMemoryReadingRepository(),
  };

  const useCases = createUseCases(
    repos,
    new Ed25519SignatureVerifier(),
    new NoopConsensusLog(),
    new Ed25519CommandSigner(),
    { minTempC: 2, maxTempC: 8, ttlSeconds: 60 }
  );

  const app = await buildServer({
    logger: createLogger({ level: "silent", pretty: false }),
    corsOrigin: ["*"],
    verifier: new StubTokenVerifier(),
    useCases,
  });

  await app.ready();
  return app;
}
