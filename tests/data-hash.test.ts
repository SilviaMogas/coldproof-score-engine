import { expect, it } from "vitest";
import { scoreInputHash } from "../src/scoring/data-hash.js";
import type { CarrierMetrics } from "../src/scoring/types.js";

const input: CarrierMetrics = {
  carrierId: "X", ensName: "x.coldproof.eth", totalShipments: 10,
  completedShipments: 9, compliantShipments: 8, onTimeShipments: 7, incidents: 1,
};
it("is deterministic and ignores non-score metadata", () => {
  expect(scoreInputHash(input, "1.0")).toBe(scoreInputHash({ ...input, graphBlockNumber: 99 }, "1.0"));
});
it("changes when metrics change", () => {
  expect(scoreInputHash(input, "1.0")).not.toBe(scoreInputHash({ ...input, incidents: 2 }, "1.0"));
});
