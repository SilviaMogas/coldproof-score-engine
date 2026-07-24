import Fastify from "fastify";
import cors from "@fastify/cors";
import type { Logger } from "pino";
import type { TokenVerifier } from "../../application/ports/token-verifier.js";
import type { RegisterDevice } from "../../application/device/register-device.js";
import type { ListDevices } from "../../application/device/list-devices.js";
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
}

/**
 * Wires the HTTP interface: logging, a domain-aware error handler, auth and the
 * feature routes. All dependencies are injected from the composition root.
 */
export async function buildServer(deps: ServerDeps) {
  const app = Fastify({ loggerInstance: deps.logger });

  app.setErrorHandler((error, req, reply) => {
    if (error instanceof AppError) {
      req.log.warn({ code: error.code }, error.message);
      return reply
        .code(error.statusCode)
        .send({ error: { code: error.code, message: error.message } });
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
    })
  );

  return app;
}
