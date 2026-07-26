import fixture from "../../fixtures/carrier-metrics.json";
import model from "../../config/score-model.json";
import { adaptCarrierMetrics } from "../graph/carrier-metrics-adapter";
import { calculateRatesAndScore } from "../scoring/score-formula";
import { buildCarrierAttestations } from "../scoring/attestations";

const allowlist = Object.fromEntries(
  fixture.data.carriers.map((carrier) => [carrier.carrierId, carrier.ensName]),
);

export const carriers = adaptCarrierMetrics(fixture.data, allowlist)
  .map((metrics) => {
    const result = calculateRatesAndScore(metrics, model);
    return { ...metrics, ...result, attestations: buildCarrierAttestations(metrics, result) };
  })
  .sort((a, b) => b.score - a.score);
