import type { CarrierMetrics, ScoreResult } from "../scoring/types.js";
import { attestationsHash, buildCarrierAttestations } from "../scoring/attestations.js";

export const SCORE_KEYS = [
  "com.coldproof.score", "com.coldproof.grade", "com.coldproof.totalShipments",
  "com.coldproof.completedShipments", "com.coldproof.compliantShipments",
  "com.coldproof.onTimeShipments", "com.coldproof.incidents",
  "com.coldproof.complianceRate", "com.coldproof.onTimeRate",
  "com.coldproof.completionRate", "com.coldproof.scoreVersion",
  "com.coldproof.scoreStatus", "com.coldproof.scoreUpdatedAt",
  "com.coldproof.graphBlock", "com.coldproof.dataHash",
  "com.coldproof.attestations", "com.coldproof.attestationCount",
  "com.coldproof.attestationsHash", "com.coldproof.attestationsVersion",
] as const;
export type ScoreKey = typeof SCORE_KEYS[number];
export type ScoreRecords = Record<ScoreKey, string>;

export function buildScoreRecords(
  metrics: CarrierMetrics, result: ScoreResult, updatedAt: string,
): ScoreRecords {
  const attestations = buildCarrierAttestations(metrics, result);
  return {
    "com.coldproof.score": String(result.score),
    "com.coldproof.grade": result.grade,
    "com.coldproof.totalShipments": String(metrics.totalShipments),
    "com.coldproof.completedShipments": String(metrics.completedShipments),
    "com.coldproof.compliantShipments": String(metrics.compliantShipments),
    "com.coldproof.onTimeShipments": String(metrics.onTimeShipments),
    "com.coldproof.incidents": String(metrics.incidents),
    "com.coldproof.complianceRate": result.complianceRate.toFixed(2),
    "com.coldproof.onTimeRate": result.onTimeRate.toFixed(2),
    "com.coldproof.completionRate": result.completionRate.toFixed(2),
    "com.coldproof.scoreVersion": result.scoreVersion,
    "com.coldproof.scoreStatus": result.status,
    "com.coldproof.scoreUpdatedAt": updatedAt,
    "com.coldproof.graphBlock": metrics.graphBlockNumber === undefined ? "" : String(metrics.graphBlockNumber),
    "com.coldproof.dataHash": result.dataHash,
    "com.coldproof.attestations": JSON.stringify(attestations),
    "com.coldproof.attestationCount": String(attestations.length),
    "com.coldproof.attestationsHash": attestationsHash(attestations),
    "com.coldproof.attestationsVersion": "1.0",
  };
}

export function changedRecordKeys(
  previous: Partial<ScoreRecords>, next: ScoreRecords, minScoreChange: number,
): ScoreKey[] {
  const supporting = SCORE_KEYS.filter((key) =>
    key !== "com.coldproof.score" && key !== "com.coldproof.scoreUpdatedAt" &&
    previous[key] !== next[key]);
  const oldScore = Number(previous["com.coldproof.score"]);
  const scoreChanged = !Number.isFinite(oldScore) ||
    Math.abs(Number(next["com.coldproof.score"]) - oldScore) >= minScoreChange;
  if (!scoreChanged && supporting.length === 0) return [];
  return SCORE_KEYS.filter((key) => previous[key] !== next[key]);
}
