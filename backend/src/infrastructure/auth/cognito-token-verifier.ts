import { CognitoJwtVerifier } from "aws-jwt-verify";
import type {
  AuthenticatedUser,
  TokenVerifier,
} from "../../application/ports/token-verifier.js";
import { UnauthorizedError } from "../../shared/errors.js";

export interface CognitoConfig {
  userPoolId: string;
  clientId: string;
  tokenUse: "access" | "id";
}

/**
 * Verifies Cognito-issued JWTs against the user pool's JWKS (fetched and cached
 * by aws-jwt-verify). Maps the raw claims onto the provider-agnostic
 * AuthenticatedUser shape used by the rest of the app.
 */
export class CognitoTokenVerifier implements TokenVerifier {
  private readonly verifier: ReturnType<typeof CognitoJwtVerifier.create>;

  constructor(config: CognitoConfig) {
    this.verifier = CognitoJwtVerifier.create({
      userPoolId: config.userPoolId,
      clientId: config.clientId,
      tokenUse: config.tokenUse,
    });
  }

  async verify(token: string): Promise<AuthenticatedUser> {
    let payload: Record<string, unknown>;
    try {
      payload = (await this.verifier.verify(token)) as Record<string, unknown>;
    } catch {
      throw new UnauthorizedError("invalid or expired token");
    }

    const scope = typeof payload["scope"] === "string" ? payload["scope"] : "";
    const groupsClaim = payload["cognito:groups"];
    const groups = Array.isArray(groupsClaim)
      ? groupsClaim.filter((g): g is string => typeof g === "string")
      : [];

    const username =
      (typeof payload["username"] === "string" && payload["username"]) ||
      (typeof payload["cognito:username"] === "string" &&
        payload["cognito:username"]) ||
      null;

    return {
      sub: String(payload["sub"] ?? ""),
      username: username || null,
      scopes: scope ? scope.split(" ").filter(Boolean) : [],
      groups,
    };
  }
}
