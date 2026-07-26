import { expect, it } from "vitest";
import { resolveCarrierEnsName, validateCarrierEnsName } from "../src/graph/carrier-metrics-adapter.js";

it("rejects names outside the direct ColdProof namespace", () => {
  expect(() => validateCarrierEnsName("x.example.eth")).toThrow();
  expect(() => validateCarrierEnsName("x.y.coldproof.eth")).toThrow();
});
it("maps a carrier ID when Graph omits ensName", () => {
  expect(resolveCarrierEnsName("X", undefined, { X: "carrier.coldproof.eth" }))
    .toBe("carrier.coldproof.eth");
});
