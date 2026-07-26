import { describe, expect, it } from "vitest";
import { attestationsHash, buildCarrierAttestations } from "../src/scoring/attestations.js";
import type { CarrierMetrics, ScoreResult } from "../src/scoring/types.js";

const metrics: CarrierMetrics = {
  carrierId: "COMPANY-001",
  displayName: "DHL Express",
  carrierType: "transport_company",
  ensName: "dhl-express.coldproof.eth",
  ensProfileUrl: "https://app.ens.dev/dhl-express.coldproof.eth",
  totalShipments: 100,
  completedShipments: 99,
  compliantShipments: 98,
  onTimeShipments: 96,
  incidents: 2,
};

const result: ScoreResult = {
  score: 98,
  grade: "A+",
  status: "scored",
  complianceRate: 98,
  onTimeRate: 96,
  completionRate: 99,
  scoreVersion: "1.0",
  dataHash: "0x1234",
};

describe("carrier attestations", () => {
  it("creates five deterministic verified claims", () => {
    const attestations = buildCarrierAttestations(metrics, result);
    expect(attestations).toHaveLength(5);
    expect(attestations.every((item) => item.status === "verified")).toBe(true);
    expect(attestationsHash(attestations)).toBe(attestationsHash(buildCarrierAttestations(metrics, result)));
  });

  it("changes the commitment when evidence changes", () => {
    const before = buildCarrierAttestations(metrics, result);
    const after = buildCarrierAttestations({ ...metrics, incidents: 3 }, result);
    expect(attestationsHash(before)).not.toBe(attestationsHash(after));
  });
});
