import { NextRequest, NextResponse } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { syncWhoopUser } from "@/lib/whoop/sync";

/**
 * GET /api/whoop/sync — Vercel cron job (daily sync for all connected users)
 * POST /api/whoop/sync — Authenticated user manual sync
 */

export async function GET(req: NextRequest) {
  // Vercel cron authentication
  const cronSecret = process.env.CRON_SECRET;
  const authHeader = req.headers.get("authorization");

  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const serviceClient = createServiceClient();

  const { data: integrations } = await serviceClient
    .from("user_integrations")
    .select("user_id")
    .eq("provider", "whoop");

  if (!integrations || integrations.length === 0) {
    return NextResponse.json({ message: "No Whoop integrations to sync", synced: 0 });
  }

  const results: Array<{ userId: string; result?: unknown; error?: string }> = [];

  for (const integration of integrations) {
    try {
      const result = await syncWhoopUser(integration.user_id);
      results.push({ userId: integration.user_id, result });
    } catch (e) {
      results.push({
        userId: integration.user_id,
        error: e instanceof Error ? e.message : String(e),
      });
    }
  }

  return NextResponse.json({ synced: results.length, results });
}

export async function POST() {
  if (!process.env.WHOOP_CLIENT_ID || !process.env.WHOOP_CLIENT_SECRET) {
    return NextResponse.json({ error: "Whoop integration not configured" }, { status: 503 });
  }

  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const result = await syncWhoopUser(user.id);
    return NextResponse.json({ success: true, ...result });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Sync failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
