import { keccak256, toUtf8Bytes } from "ethers";
import { canonicalJson } from "./data-hash.js";
import type { CarrierMetrics, ScoreResult } from "./types.js";

export interface CarrierAttestation {
  id: "reputation" | "compliance" | "on-time" | "completion" | "incidents";
  title: string;
  value: string;
  evidence: string;
  status: "verified";
}

type AttestationScore = Pick<
  ScoreResult,
  "score" | "grade" | "complianceRate" | "onTimeRate" | "completionRate"
> & { scoreVersion?: string };

export function buildCarrierAttestations(
  metrics: CarrierMetrics,
  result: AttestationScore,
): CarrierAttestation[] {
  return [
    {
      id: "reputation",
      title: "ColdProof reputation",
      value: `${result.score}/100 · ${result.grade}`,
      evidence: `Score Engine ${result.scoreVersion ?? "1.0"}`,
      status: "verified",
    },
    {
      id: "compliance",
      title: "Cold-chain compliance",
      value: `${result.complianceRate.toFixed(2)}%`,
      evidence: `${metrics.compliantShipments}/${metrics.totalShipments} compliant shipments`,
      status: "verified",
    },
    {
      id: "on-time",
      title: "On-time performance",
      value: `${result.onTimeRate.toFixed(2)}%`,
      evidence: `${metrics.onTimeShipments}/${metrics.totalShipments} on-time shipments`,
      status: "verified",
    },
    {
      id: "completion",
      title: "Delivery completion",
      value: `${result.completionRate.toFixed(2)}%`,
      evidence: `${metrics.completedShipments}/${metrics.totalShipments} completed shipments`,
      status: "verified",
    },
    {
      id: "incidents",
      title: "Incident disclosure",
      value: `${metrics.incidents} recorded`,
      evidence: `${metrics.totalShipments} shipments reviewed`,
      status: "verified",
    },
  ];
}

export function attestationsHash(attestations: CarrierAttestation[]): string {
  return keccak256(toUtf8Bytes(canonicalJson(attestations)));
}
