import type { AuthProviderProps } from "react-oidc-context";
import { config } from "../config";

/**
 * OIDC configuration for Cognito Hosted UI using the Authorization Code flow
 * with PKCE. Endpoints are discovered from the authority's
 * /.well-known/openid-configuration document.
 */
export const oidcConfig: AuthProviderProps = {
  authority: config.cognito.authority,
  client_id: config.cognito.clientId,
  redirect_uri: config.cognito.redirectUri,
  post_logout_redirect_uri: config.cognito.logoutUri,
  response_type: "code",
  scope: config.cognito.scope,
  automaticSilentRenew: true,
  // Clean the ?code=...&state=... params from the URL after login.
  onSigninCallback: () => {
    window.history.replaceState(
      {},
      document.title,
      window.location.pathname
    );
  },
};

/**
 * Cognito's OIDC discovery does not expose a standard end_session_endpoint, so
 * sign-out is done via the Hosted UI /logout endpoint when a domain is set.
 */
export function cognitoLogoutUrl(): string | null {
  if (!config.cognito.domain) return null;
  const params = new URLSearchParams({
    client_id: config.cognito.clientId,
    logout_uri: config.cognito.logoutUri,
  });
  return `${config.cognito.domain.replace(/\/$/, "")}/logout?${params.toString()}`;
}
