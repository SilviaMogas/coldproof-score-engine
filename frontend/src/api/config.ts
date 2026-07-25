import { apiFetch } from "./client";

export interface AppConfig {
  /** Whether the server has Sepolia escrow settlement configured. */
  settlementEnabled: boolean;
  escrowAddress: string | null;
  chainId: number;
  minTempC: number;
  maxTempC: number;
  requiredReadings: number;
  durationSeconds: number;
}

export function getConfig(): Promise<AppConfig> {
  return apiFetch<AppConfig>("/config");
}
