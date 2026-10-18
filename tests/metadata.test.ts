import { readFileSync } from "node:fs";
import { expect, it } from "vitest";

it("identifies the presentation data and canonical ranking site in static HTML", () => {
  const html = readFileSync(new URL("../index.html", import.meta.url), "utf8");
  expect(html).toContain('<link rel="canonical" href="https://coldproof-score-engine.vercel.app/" />');
  expect(html).toMatch(/<meta name="description" content="[^"]*presentation data\."/);
  expect(html.match(/rel="canonical"/g)).toHaveLength(1);
});
