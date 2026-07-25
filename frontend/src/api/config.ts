import { apiFetch } from "./client";

export interface AppConfig {
  /** Whether the server has HBAR escrow settlement configured. */
  settlementEnabled: boolean;
}

export function getConfig(): Promise<AppConfig> {
  return apiFetch<AppConfig>("/config");
}
