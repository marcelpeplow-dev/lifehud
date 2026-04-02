import { NextRequest, NextResponse } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { exchangeWhoopCode } from "@/lib/whoop/client";
import { syncWhoopUser, getWhoopProfile } from "@/lib/whoop/sync";

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;
  const code = searchParams.get("code");
  const state = searchParams.get("state");
  const error = searchParams.get("error");

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
  const redirectUri = `${appUrl}/api/whoop/callback`;

  if (error || !code || !state) {
    return NextResponse.redirect(
      `${appUrl}/dashboard/settings?whoop_error=${encodeURIComponent(error ?? "missing_code")}`
    );
  }

  // Decode state to get user ID
  let statePayload: { userId: string };
  try {
    statePayload = JSON.parse(Buffer.from(state, "base64url").toString());
  } catch {
    return NextResponse.redirect(`${appUrl}/dashboard/settings?whoop_error=invalid_state`);
  }

  // Verify the user is logged in and matches the state
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user || user.id !== statePayload.userId) {
    return NextResponse.redirect(`${appUrl}/dashboard/settings?whoop_error=auth_mismatch`);
  }

  // Exchange code for tokens
  let tokens;
  try {
    tokens = await exchangeWhoopCode(code, redirectUri);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "token_exchange_failed";
    return NextResponse.redirect(
      `${appUrl}/dashboard/settings?whoop_error=${encodeURIComponent(msg)}`
    );
  }

  // Fetch Whoop user profile to get the provider user ID
  let whoopUserId: string | null = null;
  try {
    const profile = await getWhoopProfile(tokens.access_token);
    whoopUserId = String(profile.user_id);
  } catch {
    // Non-fatal — we can still store the integration without the provider user ID
  }

  // Store integration (upsert in case user reconnects)
  const serviceClient = createServiceClient();
  const expiresAt = new Date(Date.now() + tokens.expires_in * 1000).toISOString();

  const { error: dbError } = await serviceClient
    .from("user_integrations")
    .upsert(
      {
        user_id: user.id,
        provider: "whoop",
        access_token: tokens.access_token,
        refresh_token: tokens.refresh_token,
        token_expires_at: expiresAt,
        scopes: tokens.scope,
        provider_user_id: whoopUserId,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "user_id,provider" }
    );

  if (dbError) {
    return NextResponse.redirect(
      `${appUrl}/dashboard/settings?whoop_error=${encodeURIComponent(dbError.message)}`
    );
  }

  // Trigger initial sync in background (don't block redirect)
  syncWhoopUser(user.id).catch((e) => {
    console.error("Initial Whoop sync failed:", e);
  });

  return NextResponse.redirect(`${appUrl}/dashboard/settings?connected=whoop`);
}
