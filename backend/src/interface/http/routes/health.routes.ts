import type { FastifyInstance } from "fastify";

/** Public liveness endpoint. */
export async function healthRoutes(app: FastifyInstance): Promise<void> {
  app.get("/health", async () => ({
    status: "ok",
    uptime: process.uptime(),
  }));
}
