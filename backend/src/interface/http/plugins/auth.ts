import type { FastifyReply, FastifyRequest } from "fastify";
import fp from "fastify-plugin";
import type {
  AuthenticatedUser,
  TokenVerifier,
} from "../../../application/ports/token-verifier.js";
import { UnauthorizedError } from "../../../shared/errors.js";

declare module "fastify" {
  interface FastifyRequest {
    user: AuthenticatedUser | null;
  }
  interface FastifyInstance {
    /** preHandler that requires a valid bearer token and populates request.user. */
    authenticate: (req: FastifyRequest, reply: FastifyReply) => Promise<void>;
  }
}

export interface AuthPluginOptions {
  verifier: TokenVerifier;
}

/**
 * Registers bearer-token authentication. Routes opt in via
 * `{ preHandler: app.authenticate }`.
 */
export const authPlugin = fp<AuthPluginOptions>(async (app, opts) => {
  app.decorateRequest("user", null);

  app.decorate("authenticate", async (req: FastifyRequest) => {
    const header = req.headers.authorization;
    if (!header || !header.startsWith("Bearer ")) {
      throw new UnauthorizedError("missing bearer token");
    }

    const token = header.slice("Bearer ".length).trim();
    if (!token) {
      throw new UnauthorizedError("missing bearer token");
    }

    req.user = await opts.verifier.verify(token);
  });
});
