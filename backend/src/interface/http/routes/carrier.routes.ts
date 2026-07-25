import type { FastifyInstance } from "fastify";
import { z } from "zod";
import type { Carrier } from "../../../domain/carrier/carrier.js";
import type { RegisterCarrier } from "../../../application/carrier/register-carrier.js";
import type { ListCarriers } from "../../../application/carrier/list-carriers.js";
import type { DeleteCarrier } from "../../../application/carrier/delete-carrier.js";
import { ValidationError } from "../../../shared/errors.js";

const registerBody = z.object({
  name: z.string().min(1),
  hederaAccountId: z
    .string()
    .regex(/^\d+\.\d+\.\d+$/, "must be a Hedera account id like 0.0.1234")
    .optional(),
});

const idParams = z.object({
  id: z.string().min(1),
});

export interface CarrierRoutesDeps {
  registerCarrier: RegisterCarrier;
  listCarriers: ListCarriers;
  deleteCarrier: DeleteCarrier;
}

/**
 * Carrier management routes (backoffice). All routes require authentication.
 */
export function carrierRoutes(deps: CarrierRoutesDeps) {
  return async function (app: FastifyInstance): Promise<void> {
    app.get(
      "/carriers",
      { preHandler: app.authenticate },
      async () => {
        const carriers = await deps.listCarriers.execute();
        return { carriers: carriers.map(toDto) };
      }
    );

    app.post(
      "/carriers",
      { preHandler: app.authenticate },
      async (req, reply) => {
        const parsed = registerBody.safeParse(req.body);
        if (!parsed.success) {
          throw new ValidationError(
            parsed.error.issues
              .map((i) => `${i.path.join(".")}: ${i.message}`)
              .join(", ")
          );
        }

        const carrier = await deps.registerCarrier.execute(
          parsed.data
        );
        reply.code(201);
        return toDto(carrier);
      }
    );

    app.delete(
      "/carriers/:id",
      { preHandler: app.authenticate },
      async (req, reply) => {
        const parsed = idParams.safeParse(req.params);
        if (!parsed.success) {
          throw new ValidationError(
            parsed.error.issues
              .map((i) => `${i.path.join(".")}: ${i.message}`)
              .join(", ")
          );
        }

        await deps.deleteCarrier.execute(parsed.data.id);
        return reply.code(204).send();
      }
    );
  };
}

function toDto(t: Carrier) {
  return {
    id: t.id,
    name: t.name,
    hederaAccountId: t.hederaAccountId,
  };
}
