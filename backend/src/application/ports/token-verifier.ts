/**
 * The authenticated principal extracted from a verified token. Kept independent
 * of any specific identity provider so Cognito can later be swapped or joined by
 * other providers.
 */
export interface AuthenticatedUser {
  sub: string;
  username: string | null;
  scopes: string[];
  groups: string[];
}

/**
 * Port for verifying a bearer token and resolving the authenticated user.
 * Implemented in infrastructure (e.g. Cognito).
 */
export interface TokenVerifier {
  verify(token: string): Promise<AuthenticatedUser>;
}
