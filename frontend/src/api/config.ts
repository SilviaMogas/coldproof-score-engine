import { apiFetch } from "./client";

export interface AppConfig {
  settlementEnabled: boolean;
  blockchainProvider: "hedera" | "sepolia";
  currency: "HBAR" | "ETH";
  chainId: number | null;
  escrowAccount: string | null;
}

export function getConfig(): Promise<AppConfig> {
  return apiFetch<AppConfig>("/config");
}
