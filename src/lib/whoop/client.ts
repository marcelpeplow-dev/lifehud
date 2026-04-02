import { createServiceClient } from "@/lib/supabase/server";

// ── Whoop OAuth Configuration ────────────────────────────────────────────────

const WHOOP_AUTH_URL = "https://api.prod.whoop.com/oauth/oauth2/auth";
const WHOOP_TOKEN_URL = "https://api.prod.whoop.com/oauth/oauth2/token";
const WHOOP_API_BASE = "https://api.prod.whoop.com/developer";

const SCOPES = [
  "read:recovery",
  "read:cycles",
  "read:workout",
  "read:sleep",
  "read:profile",
  "read:body_measurement",
].join(" ");

function getClientId(): string {
  const id = process.env.WHOOP_CLIENT_ID;
  if (!id) throw new Error("WHOOP_CLIENT_ID is not set");
  return id;
}

function getClientSecret(): string {
  const secret = process.env.WHOOP_CLIENT_SECRET;
  if (!secret) throw new Error("WHOOP_CLIENT_SECRET is not set");
  return secret;
}

// ── Authorization URL ────────────────────────────────────────────────────────

export function buildWhoopAuthUrl(redirectUri: string, state: string): string {
  const params = new URLSearchParams({
    response_type: "code",
    client_id: getClientId(),
    redirect_uri: redirectUri,
    scope: SCOPES,
    state,
  });
  return `${WHOOP_AUTH_URL}?${params.toString()}`;
}

// ── Token Exchange ───────────────────────────────────────────────────────────

export interface WhoopTokens {
  access_token: string;
  refresh_token: string;
  expires_in: number;
  token_type: string;
  scope: string;
}

export async function exchangeWhoopCode(
  code: string,
  redirectUri: string
): Promise<WhoopTokens> {
  const res = await fetch(WHOOP_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "authorization_code",
      code,
      redirect_uri: redirectUri,
      client_id: getClientId(),
      client_secret: getClientSecret(),
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Whoop token exchange failed: ${res.status} ${text}`);
  }

  return res.json();
}

// ── Token Refresh ────────────────────────────────────────────────────────────

export async function refreshWhoopToken(refreshToken: string): Promise<WhoopTokens> {
  const res = await fetch(WHOOP_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "refresh_token",
      refresh_token: refreshToken,
      client_id: getClientId(),
      client_secret: getClientSecret(),
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Whoop token refresh failed: ${res.status} ${text}`);
  }

  return res.json();
}

// ── Integration type ─────────────────────────────────────────────────────────

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
 */
export async function getValidWhoopToken(
  userId: string
): Promise<{ token: string; integration: Integration }> {
  const supabase = createServiceClient();

  const { data: integration, error } = await supabase
    .from("user_integrations")
    .select("*")
    .eq("user_id", userId)
    .eq("provider", "whoop")
    .single();

  if (error || !integration) {
    throw new Error("No Whoop integration found for user");
  }

  const expiresAt = new Date(integration.token_expires_at);
  const now = new Date();

  // Refresh if token expires within 5 minutes
  if (expiresAt.getTime() - now.getTime() < 5 * 60 * 1000) {
    const tokens = await refreshWhoopToken(integration.refresh_token);
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
      integration: {
        ...integration,
        access_token: tokens.access_token,
        refresh_token: tokens.refresh_token,
        token_expires_at: newExpiresAt,
      },
    };
  }

  return { token: integration.access_token, integration };
}

// ── Authenticated API Request ────────────────────────────────────────────────

export async function whoopGet(
  token: string,
  endpoint: string,
  params?: Record<string, string>
): Promise<unknown> {
  const url = new URL(`${WHOOP_API_BASE}${endpoint}`);
  if (params) {
    Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));
  }

  const res = await fetch(url.toString(), {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (res.status === 429) {
    throw new Error("Whoop rate limit exceeded");
  }

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Whoop API error: ${res.status} ${text}`);
  }

  return res.json();
}

// ── Paginated Fetch ──────────────────────────────────────────────────────────

interface WhoopPagedResponse {
  records: unknown[];
  next_token?: string;
}

/**
 * Fetch all pages of a Whoop endpoint (cursor-based pagination).
 */
export async function whoopFetchAll(
  token: string,
  endpoint: string,
  params?: Record<string, string>
): Promise<unknown[]> {
  const allRecords: unknown[] = [];
  let nextToken: string | undefined;

  do {
    const queryParams: Record<string, string> = { ...params, limit: "25" };
    if (nextToken) queryParams.nextToken = nextToken;

    const data = (await whoopGet(token, endpoint, queryParams)) as WhoopPagedResponse;
    allRecords.push(...(data.records ?? []));
    nextToken = data.next_token;

    // Rate limit protection between paginated requests
    if (nextToken) {
      await new Promise((r) => setTimeout(r, 500));
    }
  } while (nextToken);

  return allRecords;
}
