import type { FastifyInstance } from "fastify";

export interface ConfigRoutesDeps {
  settlementEnabled: boolean;
  escrowAddress: string | null;
  chainId: number;
  minTempC: number;
  maxTempC: number;
  requiredReadings: number;
  durationSeconds: number;
}

/**
 * Public runtime configuration the frontend uses to adapt its UI (e.g. only
 * offering the Sepolia escrow flow when settlement is configured).
 */
export function configRoutes(deps: ConfigRoutesDeps) {
  return async function (app: FastifyInstance): Promise<void> {
    app.get("/config", async () => ({
      settlementEnabled: deps.settlementEnabled,
      escrowAddress: deps.escrowAddress,
      chainId: deps.chainId,
      minTempC: deps.minTempC,
      maxTempC: deps.maxTempC,
      requiredReadings: deps.requiredReadings,
      durationSeconds: deps.durationSeconds,
    }));
  };
}
