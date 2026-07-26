import { expect, it } from "vitest";
import { buildScoreRecords, changedRecordKeys } from "../src/ens/score-records.js";
import { scoreCarrier } from "../src/scoring/score-engine.js";

const metrics = {
  carrierId: "X", ensName: "x.coldproof.eth", totalShipments: 100,
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
