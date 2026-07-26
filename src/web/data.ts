import fixture from "../../fixtures/carrier-metrics.json";
import model from "../../config/score-model.json";
import { adaptCarrierMetrics } from "../graph/carrier-metrics-adapter";
import { calculateRatesAndScore } from "../scoring/score-formula";

const allowlist = Object.fromEntries(
  fixture.data.carriers.map((carrier) => [carrier.carrierId, carrier.ensName]),
);

export const carriers = adaptCarrierMetrics(fixture.data, allowlist)
  .map((metrics) => ({
    ...metrics,
    ...calculateRatesAndScore(metrics, model),
  }))
  .sort((a, b) => b.score - a.score);
