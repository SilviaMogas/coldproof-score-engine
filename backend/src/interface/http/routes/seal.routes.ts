import type { FastifyInstance } from "fastify";
import { z } from "zod";
import type { SealDelivery } from "../../../application/delivery/seal-delivery.js";
import { ValidationError } from "../../../shared/errors.js";

const envelopeBody = z.object({
  message: z.string().min(1),
  publicKey: z.string().min(1),
  signature: z.string().min(1),
});

export interface SealRoutesDeps {
  sealDelivery: SealDelivery;
}

/**
 * `POST /seal` starts a delivery when the box is physically sealed in the field.
 * It is authenticated by the device's own Ed25519 signature (like `/readings`
 * and `/unlock`, no bearer token), replacing the operator's manual "Start".
 */
export function sealRoutes(deps: SealRoutesDeps) {
  return async function (app: FastifyInstance): Promise<void> {
    app.post("/seal", async (req, reply) => {
      const parsed = envelopeBody.safeParse(req.body);
      if (!parsed.success) {
        throw new ValidationError(
          parsed.error.issues
            .map((i) => `${i.path.join(".")}: ${i.message}`)
            .join(", ")
        );
      }

      const decision = await deps.sealDelivery.execute(parsed.data);
      reply.code(200);
      return decision;
    });
  };
}
