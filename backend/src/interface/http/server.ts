import Fastify from "fastify";
import cors from "@fastify/cors";
import type { Logger } from "pino";
import type { TokenVerifier } from "../../application/ports/token-verifier.js";
import type { RegisterDevice } from "../../application/device/register-device.js";
import type { ListDevices } from "../../application/device/list-devices.js";
import type { DeleteDevice } from "../../application/device/delete-device.js";
import { AppError } from "../../shared/errors.js";
import { authPlugin } from "./plugins/auth.js";
import { healthRoutes } from "./routes/health.routes.js";
import { deviceRoutes } from "./routes/device.routes.js";

export interface ServerDeps {
  logger: Logger;
  corsOrigin: string[];
  verifier: TokenVerifier;
  registerDevice: RegisterDevice;
  listDevices: ListDevices;
  deleteDevice: DeleteDevice;
}

/**
 * Wires the HTTP interface: logging, a domain-aware error handler, auth and the
 * feature routes. All dependencies are injected from the composition root.
 */
export async function buildServer(deps: ServerDeps) {
  const app = Fastify({ loggerInstance: deps.logger });

  // Treat an empty JSON body as "no body" so bodyless requests such as DELETE
  // don't fail when a client still sends `content-type: application/json`.
  app.addContentTypeParser(
    "application/json",
    { parseAs: "string" },
    (_req, body, done) => {
      const text = typeof body === "string" ? body.trim() : "";
      if (text.length === 0) {
        done(null, undefined);
        return;
      }
      try {
        done(null, JSON.parse(text));
      } catch (err) {
        (err as { statusCode?: number }).statusCode = 400;
        done(err as Error, undefined);
      }
    }
  );

  app.setErrorHandler((error, req, reply) => {
    if (error instanceof AppError) {
      req.log.warn({ code: error.code }, error.message);
      return reply
        .code(error.statusCode)
        .send({ error: { code: error.code, message: error.message } });
    }

    const httpError = error as {
      statusCode?: number;
      code?: string;
      message?: string;
    };
    if (
      typeof httpError.statusCode === "number" &&
      httpError.statusCode >= 400 &&
      httpError.statusCode < 500
    ) {
      req.log.warn({ err: error }, httpError.message ?? "request error");
      return reply.code(httpError.statusCode).send({
        error: {
          code: httpError.code ?? "BAD_REQUEST",
          message: httpError.message ?? "bad request",
        },
      });
    }

    req.log.error({ err: error }, "unhandled error");
    return reply
      .code(500)
      .send({ error: { code: "INTERNAL", message: "internal server error" } });
  });

  await app.register(cors, { origin: deps.corsOrigin });
  await app.register(authPlugin, { verifier: deps.verifier });
  await app.register(healthRoutes);
  await app.register(
    deviceRoutes({
      registerDevice: deps.registerDevice,
      listDevices: deps.listDevices,
      deleteDevice: deps.deleteDevice,
    })
  );

  return app;
}
