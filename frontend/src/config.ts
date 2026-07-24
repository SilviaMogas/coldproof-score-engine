export const config = {
  apiBaseUrl: import.meta.env.VITE_API_BASE_URL ?? "http://localhost:3001",
  adminGroup: import.meta.env.VITE_ADMIN_GROUP ?? "admin",
  cognito: {
    authority: import.meta.env.VITE_COGNITO_AUTHORITY ?? "",
    clientId: import.meta.env.VITE_COGNITO_CLIENT_ID ?? "",
    redirectUri:
      import.meta.env.VITE_REDIRECT_URI ?? window.location.origin,
    scope: import.meta.env.VITE_COGNITO_SCOPE ?? "openid email profile",
    domain: import.meta.env.VITE_COGNITO_DOMAIN ?? "",
    logoutUri:
      import.meta.env.VITE_COGNITO_LOGOUT_URI ?? window.location.origin,
  },
} as const;
