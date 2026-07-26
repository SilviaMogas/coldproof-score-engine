import { ensNormalize } from "ethers";
import type { CarrierMetrics } from "../scoring/types.js";

interface CarrierRow {
  carrierId?: unknown; ensName?: unknown; totalShipments?: unknown;
  completedShipments?: unknown; compliantShipments?: unknown;
  onTimeShipments?: unknown; incidents?: unknown; lastActivityTimestamp?: unknown;
}
export interface CarrierGraphData {
  carriers?: unknown;
  _meta?: { block?: { number?: unknown } };
}

const integer = (value: unknown, field: string): number => {
  const number = typeof value === "string" && value.trim() ? Number(value) : value;
  if (typeof number !== "number" || !Number.isSafeInteger(number)) {
    throw new Error(`Graph field ${field} must be a safe integer`);
  }
  return number;
};

export function validateCarrierEnsName(name: string, parent = "coldproof.eth"): string {
  let normalised: string;
  try { normalised = ensNormalize(name); } catch { throw new Error(`Invalid ENS name: ${name}`); }
  const labels = normalised.split(".");
  const parentLabels = parent.split(".");
  if (labels.length !== parentLabels.length + 1 ||
      labels.slice(-parentLabels.length).join(".") !== parent) {
    throw new Error(`ENS name must be a direct child of ${parent}: ${name}`);
  }
  return normalised;
}

export function resolveCarrierEnsName(
  carrierId: string, graphName: unknown, mapping: Readonly<Record<string, string>>,
  parent = "coldproof.eth",
): string {
  const candidate = typeof graphName === "string" && graphName.trim()
    ? graphName : mapping[carrierId];
  if (!candidate) throw new Error(`No ENS mapping for carrier ${carrierId}`);
  return validateCarrierEnsName(candidate, parent);
}

export function adaptCarrierMetrics(
  data: CarrierGraphData, mapping: Readonly<Record<string, string>>, parent = "coldproof.eth",
): CarrierMetrics[] {
  if (!Array.isArray(data.carriers)) throw new Error("Graph data.carriers must be an array");
  const graphBlockNumber = data._meta?.block?.number === undefined
    ? undefined : integer(data._meta.block.number, "_meta.block.number");
  return data.carriers.map((raw, index) => {
    if (!raw || typeof raw !== "object") throw new Error(`Carrier row ${index} is invalid`);
    const row = raw as CarrierRow;
    if (typeof row.carrierId !== "string" || !row.carrierId.trim()) {
      throw new Error(`Carrier row ${index} has no carrierId`);
    }
    const base: CarrierMetrics = {
      carrierId: row.carrierId,
      ensName: resolveCarrierEnsName(row.carrierId, row.ensName, mapping, parent),
      totalShipments: integer(row.totalShipments, "totalShipments"),
      completedShipments: integer(row.completedShipments, "completedShipments"),
      compliantShipments: integer(row.compliantShipments, "compliantShipments"),
      onTimeShipments: integer(row.onTimeShipments, "onTimeShipments"),
      incidents: integer(row.incidents, "incidents"),
    };
    if (graphBlockNumber !== undefined) base.graphBlockNumber = graphBlockNumber;
    if (typeof row.lastActivityTimestamp === "string") {
      base.lastActivityTimestamp = row.lastActivityTimestamp;
    }
    return base;
  });
}
