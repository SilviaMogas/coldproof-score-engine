import { keccak256, toUtf8Bytes } from "ethers";
import type { CarrierMetrics } from "./types.js";

function canonical(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`;
  const object = value as Record<string, unknown>;
  return `{${Object.keys(object).sort().map((key) =>
    `${JSON.stringify(key)}:${canonical(object[key])}`).join(",")}}`;
}

export function scoreInputHash(metrics: CarrierMetrics, scoreVersion: string): string {
  const input = {
    carrierId: metrics.carrierId,
    completedShipments: metrics.completedShipments,
    compliantShipments: metrics.compliantShipments,
    incidents: metrics.incidents,
    onTimeShipments: metrics.onTimeShipments,
    scoreVersion,
    totalShipments: metrics.totalShipments,
  };
  return keccak256(toUtf8Bytes(canonical(input)));
}

export { canonical as canonicalJson };
