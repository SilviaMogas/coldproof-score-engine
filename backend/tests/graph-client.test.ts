import { expect, it, vi } from "vitest";
import { GraphClient } from "../src/graph/graph-client.js";

it("rejects GraphQL errors safely", async () => {
  const fetchImpl = vi.fn(async () => new Response(JSON.stringify({
    data: { carriers: [] }, errors: [{ message: "broken schema" }],
  }), { status: 200, headers: { "content-type": "application/json" } }));
  await expect(new GraphClient({ endpoint: "https://graph.invalid", fetchImpl }).query("{}"))
    .rejects.toThrow("broken schema");
});
