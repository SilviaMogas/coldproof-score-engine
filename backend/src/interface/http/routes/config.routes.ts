import type { FastifyInstance } from "fastify";

export interface ConfigRoutesDeps {
  settlementEnabled: boolean;
  blockchainProvider: "hedera" | "sepolia";
  currency: "HBAR" | "ETH";
  chainId: number | null;
  escrowAccount: string | null;
}

/**
 * Public runtime configuration the frontend uses to adapt its UI (e.g. only
 * offering the HBAR escrow flow when settlement is actually configured).
 */
export function configRoutes(deps: ConfigRoutesDeps) {
  return async function (app: FastifyInstance): Promise<void> {
    app.get("/config", async () => ({
      settlementEnabled: deps.settlementEnabled,
      blockchainProvider: deps.blockchainProvider,
      currency: deps.currency,
      chainId: deps.chainId,
      escrowAccount: deps.escrowAccount,
    }));
  };
}
