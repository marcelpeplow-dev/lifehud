import { createServiceClient } from "@/lib/supabase/server";

// ── Fitbit OAuth Configuration ───────────────────────────────────────────────

const FITBIT_AUTH_URL = "https://www.fitbit.com/oauth2/authorize";
const FITBIT_TOKEN_URL = "https://api.fitbit.com/oauth2/token";
const FITBIT_API_BASE = "https://api.fitbit.com";
const SCOPES = "activity heartrate sleep profile";

function getClientId(): string {
  const id = process.env.FITBIT_CLIENT_ID;
  if (!id) throw new Error("FITBIT_CLIENT_ID is not set");
  return id;
}

function getClientSecret(): string {
  const secret = process.env.FITBIT_CLIENT_SECRET;
  if (!secret) throw new Error("FITBIT_CLIENT_SECRET is not set");
  return secret;
}

function getRedirectUri(): string {
  const uri = process.env.FITBIT_REDIRECT_URI;
  if (!uri) throw new Error("FITBIT_REDIRECT_URI is not set");
  return uri;
}

// ── Authorization URL ────────────────────────────────────────────────────────

export function buildAuthUrl(state: string): string {
  const params = new URLSearchParams({
    response_type: "code",
    client_id: getClientId(),
    redirect_uri: getRedirectUri(),
    scope: SCOPES,
    state,
    prompt: "login consent",
  });
  return `${FITBIT_AUTH_URL}?${params.toString()}`;
}

// ── Token Exchange ───────────────────────────────────────────────────────────

interface TokenResponse {
  access_token: string;
  refresh_token: string;
  expires_in: number;
  user_id: string;
  scope: string;
  token_type: string;
}

export async function exchangeCode(code: string): Promise<TokenResponse> {
  const basicAuth = Buffer.from(`${getClientId()}:${getClientSecret()}`).toString("base64");

  const res = await fetch(FITBIT_TOKEN_URL, {
    method: "POST",
    headers: {
      Authorization: `Basic ${basicAuth}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({
      grant_type: "authorization_code",
      code,
      redirect_uri: getRedirectUri(),
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Fitbit token exchange failed: ${res.status} ${text}`);
  }

  return res.json();
}

// ── Token Refresh ────────────────────────────────────────────────────────────

export async function refreshAccessToken(refreshToken: string): Promise<TokenResponse> {
  const basicAuth = Buffer.from(`${getClientId()}:${getClientSecret()}`).toString("base64");

  const res = await fetch(FITBIT_TOKEN_URL, {
    method: "POST",
    headers: {
      Authorization: `Basic ${basicAuth}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({
      grant_type: "refresh_token",
      refresh_token: refreshToken,
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Fitbit token refresh failed: ${res.status} ${text}`);
  }

  return res.json();
}

// ── Authenticated API Call (auto-refresh) ────────────────────────────────────

interface Integration {
  id: string;
  user_id: string;
  access_token: string;
  refresh_token: string;
  token_expires_at: string;
  provider_user_id: string | null;
  last_sync_at: string | null;
}

/**
 * Get a valid access token for a user, refreshing if expired.
 * Returns the token and the integration record.
 */
export async function getValidToken(userId: string): Promise<{ token: string; integration: Integration }> {
  const supabase = createServiceClient();

  const { data: integration, error } = await supabase
    .from("user_integrations")
    .select("*")
    .eq("user_id", userId)
    .eq("provider", "fitbit")
    .single();

  if (error || !integration) {
    throw new Error("No Fitbit integration found for user");
  }

  const expiresAt = new Date(integration.token_expires_at);
  const now = new Date();

  // Refresh if token expires within 5 minutes
  if (expiresAt.getTime() - now.getTime() < 5 * 60 * 1000) {
    const tokens = await refreshAccessToken(integration.refresh_token);
    const newExpiresAt = new Date(Date.now() + tokens.expires_in * 1000).toISOString();

    await supabase
      .from("user_integrations")
      .update({
        access_token: tokens.access_token,
        refresh_token: tokens.refresh_token,
        token_expires_at: newExpiresAt,
        updated_at: new Date().toISOString(),
      })
      .eq("id", integration.id);

    return {
      token: tokens.access_token,
      integration: { ...integration, access_token: tokens.access_token, refresh_token: tokens.refresh_token, token_expires_at: newExpiresAt },
    };
  }

  return { token: integration.access_token, integration };
}

/**
 * Make an authenticated GET request to the Fitbit API.
 */
export async function fitbitGet(token: string, path: string): Promise<unknown> {
  const res = await fetch(`${FITBIT_API_BASE}${path}`, {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (res.status === 429) {
    throw new Error("Fitbit rate limit exceeded");
  }

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Fitbit API error: ${res.status} ${text}`);
  }

  return res.json();
}
