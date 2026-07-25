import type { FastifyInstance } from "fastify";
import { z } from "zod";
import type { AuthorizeUnlock } from "../../../application/unlock/authorize-unlock.js";
import { ValidationError } from "../../../shared/errors.js";

const envelopeBody = z.object({
  message: z.string().min(1),
  publicKey: z.string().min(1),
  signature: z.string().min(1),
});

export interface UnlockRoutesDeps {
  authorizeUnlock: AuthorizeUnlock;
}

/**
 * Secure-box unlock routes. `POST /unlock` is authenticated by the device's own
 * Ed25519 signature (like `/readings`, no bearer token) and returns a
 * backend-signed unlock command the device verifies before opening the latch.
 * `GET /unlock/public-key` lets a device be provisioned with the backend key.
 */
export function unlockRoutes(deps: UnlockRoutesDeps) {
  return async function (app: FastifyInstance): Promise<void> {
    app.get("/unlock/public-key", async () => {
      return { publicKey: deps.authorizeUnlock.publicKey };
    });

    app.post("/unlock", async (req, reply) => {
      const parsed = envelopeBody.safeParse(req.body);
      if (!parsed.success) {
        throw new ValidationError(
          parsed.error.issues
            .map((i) => `${i.path.join(".")}: ${i.message}`)
            .join(", ")
        );
      }

      const decision = await deps.authorizeUnlock.execute(parsed.data);
      reply.code(200);
      return decision;
    });
  };
}
