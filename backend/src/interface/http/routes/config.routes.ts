import type { FastifyInstance } from "fastify";

export interface ConfigRoutesDeps {
  settlementEnabled: boolean;
}

/**
 * Public runtime configuration the frontend uses to adapt its UI (e.g. only
 * offering the HBAR escrow flow when settlement is actually configured).
 */
export function configRoutes(deps: ConfigRoutesDeps) {
  return async function (app: FastifyInstance): Promise<void> {
    app.get("/config", async () => ({
      settlementEnabled: deps.settlementEnabled,
    }));
  };
}
