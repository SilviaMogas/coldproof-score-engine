import { describe, expect, it } from "vitest";
import { scoreCarrier } from "../src/scoring/score-engine.js";
import type { CarrierMetrics, ScoreModel } from "../src/scoring/types.js";

const model: ScoreModel = { scoreVersion: "1.0", weights: { compliance: .5, onTime: .3, completion: .2 } };
const metrics = (overrides: Partial<CarrierMetrics> = {}): CarrierMetrics => ({
  carrierId: "X", displayName: "Test Carrier", carrierType: "transport_company",
  ensName: "x.coldproof.eth", ensProfileUrl: "https://app.ens.dev/x.coldproof.eth",
  totalShipments: 100,
  completedShipments: 100, compliantShipments: 100, onTimeShipments: 100,
  incidents: 0, ...overrides,
});

describe("score formula", () => {
  it("scores a perfect carrier 100 and A+", () => {
    expect(scoreCarrier(metrics(), model)).toMatchObject({ score: 100, grade: "A+" });
  });
  it("calculates a weighted mixed score", () => {
    expect(scoreCarrier(metrics({ compliantShipments: 80, onTimeShipments: 70, completedShipments: 90 }), model))
      .toMatchObject({ score: 79, complianceRate: 80, onTimeRate: 70, completionRate: 90 });
  });
  it("marks zero shipments as insufficient", () => {
    expect(scoreCarrier(metrics({ totalShipments: 0, compliantShipments: 0, onTimeShipments: 0, completedShipments: 0 }), model))
      .toMatchObject({ score: 0, grade: "N/A", status: "insufficient_data" });
  });
  it.each([
    ["negative", { incidents: -1 }],
    ["completed", { completedShipments: 101 }],
    ["compliant", { compliantShipments: 101 }],
    ["on-time", { onTimeShipments: 101 }],
  ])("rejects invalid %s metrics", (_label, values) => {
    expect(() => scoreCarrier(metrics(values), model)).toThrow();
  });
});
