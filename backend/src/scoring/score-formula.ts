import type { CarrierMetrics, Grade, ScoreModel } from "./types.js";

function validate(metrics: CarrierMetrics): void {
  const counts = [
    metrics.totalShipments, metrics.completedShipments, metrics.compliantShipments,
    metrics.onTimeShipments, metrics.incidents,
  ];
  if (counts.some((value) => !Number.isSafeInteger(value) || value < 0)) {
    throw new Error(`Carrier ${metrics.carrierId} has a negative or non-integer metric`);
  }
  for (const [label, value] of [
    ["completedShipments", metrics.completedShipments],
    ["compliantShipments", metrics.compliantShipments],
    ["onTimeShipments", metrics.onTimeShipments],
  ] as const) {
    if (value > metrics.totalShipments) {
      throw new Error(`${label} cannot exceed totalShipments for ${metrics.carrierId}`);
    }
  }
}

const round2 = (value: number): number => Math.round(value * 100) / 100;
const rate = (value: number, total: number): number =>
  round2(Math.min(100, Math.max(0, (value / total) * 100)));

export function gradeFor(score: number, insufficient = false): Grade {
  if (insufficient) return "N/A";
  if (score >= 95) return "A+";
  if (score >= 90) return "A";
  if (score >= 80) return "B";
  if (score >= 70) return "C";
  if (score >= 60) return "D";
  return "Risk";
}

export function calculateRatesAndScore(metrics: CarrierMetrics, model: ScoreModel) {
  validate(metrics);
  if (metrics.totalShipments === 0) {
    return { score: 0, grade: gradeFor(0, true), status: "insufficient_data" as const,
      complianceRate: 0, onTimeRate: 0, completionRate: 0 };
  }
  const complianceRate = rate(metrics.compliantShipments, metrics.totalShipments);
  const onTimeRate = rate(metrics.onTimeShipments, metrics.totalShipments);
  const completionRate = rate(metrics.completedShipments, metrics.totalShipments);
  const score = Math.round(Math.min(100, Math.max(0,
    complianceRate * model.weights.compliance +
    onTimeRate * model.weights.onTime +
    completionRate * model.weights.completion)));
  return { score, grade: gradeFor(score), status: "scored" as const,
    complianceRate, onTimeRate, completionRate };
}
