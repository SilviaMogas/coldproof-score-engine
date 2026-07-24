import type { FastifyInstance } from "fastify";
import { z } from "zod";
import type { Reading } from "../../../domain/reading/reading.js";
import type { IngestReading } from "../../../application/reading/ingest-reading.js";
import type { ListReadings } from "../../../application/reading/list-readings.js";
import { ValidationError } from "../../../shared/errors.js";

const envelopeBody = z.object({
  message: z.string().min(1),
  publicKey: z.string().min(1),
  signature: z.string().min(1),
});

const listQuery = z.object({
  deviceId: z.string().min(1).optional(),
});

export interface ReadingRoutesDeps {
  ingestReading: IngestReading;
  listReadings: ListReadings;
}

/**
 * Reading ingestion routes. `POST /readings` is authenticated by the device's
 * Ed25519 signature (not a bearer token), matching the firmware envelope. The
 * `GET /readings` backoffice view requires the usual Cognito auth.
 */
export function readingRoutes(deps: ReadingRoutesDeps) {
  return async function (app: FastifyInstance): Promise<void> {
    app.post("/readings", async (req, reply) => {
      const parsed = envelopeBody.safeParse(req.body);
      if (!parsed.success) {
        throw new ValidationError(
          parsed.error.issues
            .map((i) => `${i.path.join(".")}: ${i.message}`)
            .join(", ")
        );
      }

      const reading = await deps.ingestReading.execute(parsed.data);
      reply.code(201);
      return {
        ok: true,
        id: reading.id,
        deviceId: reading.deviceId,
        seq: reading.seq,
        temperatureC: reading.temperatureC,
        unit: reading.unit,
        ts: reading.ts,
        receivedAt: reading.receivedAt.toISOString(),
      };
    });

    app.get(
      "/readings",
      { preHandler: app.authenticate },
      async (req) => {
        const parsed = listQuery.safeParse(req.query);
        if (!parsed.success) {
          throw new ValidationError(
            parsed.error.issues
              .map((i) => `${i.path.join(".")}: ${i.message}`)
              .join(", ")
          );
        }

        const readings = await deps.listReadings.execute(parsed.data.deviceId);
        return { readings: readings.map(toDto) };
      }
    );
  };
}

function toDto(r: Reading) {
  return {
    id: r.id,
    deviceId: r.deviceId,
    seq: r.seq,
    temperatureC: r.temperatureC,
    unit: r.unit,
    ts: r.ts,
    receivedAt: r.receivedAt.toISOString(),
  };
}
