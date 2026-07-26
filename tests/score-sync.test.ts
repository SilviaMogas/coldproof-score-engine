import { expect, it } from "vitest";
import { buildScoreRecords, changedRecordKeys, mergeProfileAttestation } from "../src/ens/score-records.js";
import { scoreCarrier } from "../src/scoring/score-engine.js";

const metrics = {
  carrierId: "X", displayName: "Test Carrier", carrierType: "transport_company" as const,
  ensName: "x.coldproof.eth", ensProfileUrl: "https://app.ens.dev/x.coldproof.eth",
  totalShipments: 100,
  completedShipments: 90, compliantShipments: 90, onTimeShipments: 90, incidents: 0,
};
const model = { scoreVersion: "1.0", weights: { compliance: .5, onTime: .3, completion: .2 } };
const next = buildScoreRecords(metrics, scoreCarrier(metrics, model), "now");

it("skips a score change below threshold when nothing else changed", () => {
  expect(changedRecordKeys({ ...next, "com.coldproof.score": "89", "com.coldproof.scoreUpdatedAt": "before" }, next, 2)).toEqual([]);
});
it("updates when a supporting metric changes", () => {
  const previous = { ...next, "com.coldproof.score": "89", "com.coldproof.incidents": "1" };
  expect(changedRecordKeys(previous, next, 2)).toContain("com.coldproof.incidents");
});
it("preserves the ENS bio and replaces an existing visible attestation", () => {
  const result = scoreCarrier(metrics, model);
  const first = mergeProfileAttestation("Original carrier bio.", metrics, result);
  const second = mergeProfileAttestation(first, metrics, { ...result, score: 91, grade: "A" });
  expect(second).toContain("Original carrier bio.");
  expect(second).toContain("Score 91/100 (A)");
  expect(second.match(/ColdProof attestation/g)).toHaveLength(1);
});
