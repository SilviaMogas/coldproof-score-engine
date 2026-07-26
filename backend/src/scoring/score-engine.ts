import { scoreInputHash } from "./data-hash.js";
import { calculateRatesAndScore } from "./score-formula.js";
import type { CarrierMetrics, ScoreModel, ScoreResult } from "./types.js";

export function scoreCarrier(metrics: CarrierMetrics, model: ScoreModel): ScoreResult {
  return {
    ...calculateRatesAndScore(metrics, model),
    scoreVersion: model.scoreVersion,
    dataHash: scoreInputHash(metrics, model.scoreVersion),
  };
}
