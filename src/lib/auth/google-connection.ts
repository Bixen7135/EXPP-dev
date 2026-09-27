import type { SessionUser } from "@/lib/auth/session";

type SessionWithGoogleProvider = SessionUser & {
  googleConnected?: boolean;
  isGoogleConnected?: boolean;
  authProvider?: string | null;
  oauthProvider?: string | null;
  connectedProviders?: unknown;
};

export function hasGoogleConnection(session: SessionUser): boolean {
  const maybeSession = session as SessionWithGoogleProvider;

  if (typeof maybeSession.googleConnected === "boolean") {
    return maybeSession.googleConnected;
  }

  if (typeof maybeSession.isGoogleConnected === "boolean") {
    return maybeSession.isGoogleConnected;
  }

  if (typeof maybeSession.authProvider === "string") {
    return maybeSession.authProvider.toLowerCase() === "google";
  }

  if (typeof maybeSession.oauthProvider === "string") {
    return maybeSession.oauthProvider.toLowerCase() === "google";
  }

  if (Array.isArray(maybeSession.connectedProviders)) {
    return maybeSession.connectedProviders.some(
      (provider): provider is string =>
        typeof provider === "string" && provider.toLowerCase() === "google"
    );
  }

  // Fallback for profiles synced from Google with avatar URLs from googleusercontent.
  return (
    typeof session.avatarUrl === "string" &&
    session.avatarUrl.includes("googleusercontent.com")
  );
}
