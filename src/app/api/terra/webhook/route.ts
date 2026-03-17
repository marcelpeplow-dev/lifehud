import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { verifyTerraSignature } from "@/lib/terra/client";
import { mapSleepRecord, mapActivityRecord, mapDailyRecord } from "@/lib/terra/mappers";
import type { TerraWebhookPayload } from "@/types/index";

export async function POST(request: Request) {
  // Read raw body first (needed for signature verification)
  const rawBody = await request.text();
  const signature = request.headers.get("terra-signature") ?? "";

  // Verify signature (skip in dev if secret is placeholder)
  const secret = process.env.TERRA_WEBHOOK_SECRET;
  if (secret && secret !== "placeholder") {
    if (!verifyTerraSignature(rawBody, signature)) {
      return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
    }
  }

  let payload: TerraWebhookPayload;
  try {
    payload = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const supabase = createServiceClient();
  const { type, user: terraUser } = payload;
  const provider = terraUser.provider.toUpperCase();

  // ── Auth event: new device connected ──────────────────────────────────────
  if (type === "auth") {
    const referenceId = (payload as unknown as Record<string, unknown>).reference_id as string | undefined;
    if (!referenceId) {
      return NextResponse.json({ received: true, skipped: "no reference_id" });
    }

    await supabase.from("device_connections").upsert(
      {
        user_id: referenceId,
        terra_user_id: terraUser.user_id,
        provider: provider as "FITBIT" | "APPLE" | "GARMIN" | "OURA" | "WHOOP",
        is_active: true,
        last_sync_at: new Date().toISOString(),
      },
      { onConflict: "terra_user_id" }
    );

    return NextResponse.json({ received: true, type: "auth" });
  }

  // ── Data events: look up our user via terra_user_id ───────────────────────
  const { data: connection } = await supabase
    .from("device_connections")
    .select("user_id")
    .eq("terra_user_id", terraUser.user_id)
    .eq("is_active", true)
    .single();

  if (!connection) {
    return NextResponse.json({ received: true, skipped: "unknown terra user" });
  }

  const userId = connection.user_id;
  const items = (payload.data ?? []) as unknown[];
  let inserted = 0;

  if (type === "sleep") {
    const rows = items
      .map((d) => mapSleepRecord(userId, provider, d))
      .filter((r): r is NonNullable<typeof r> => r !== null);

    if (rows.length) {
      await supabase
        .from("sleep_records")
        .upsert(rows, { onConflict: "user_id,date" });
      inserted = rows.length;
    }
  } else if (type === "activity") {
    const rows = items
      .map((d) => mapActivityRecord(userId, provider, d))
      .filter((r): r is NonNullable<typeof r> => r !== null);

    if (rows.length) {
      await supabase.from("workouts").insert(rows);
      inserted = rows.length;
    }
  } else if (type === "daily") {
    const rows = items
      .map((d) => mapDailyRecord(userId, provider, d))
      .filter((r): r is NonNullable<typeof r> => r !== null);

    if (rows.length) {
      await supabase
        .from("daily_metrics")
        .upsert(rows, { onConflict: "user_id,date" });
      inserted = rows.length;
    }
  }

  // Update last_sync_at on the connection
  await supabase
    .from("device_connections")
    .update({ last_sync_at: new Date().toISOString() })
    .eq("terra_user_id", terraUser.user_id);

  return NextResponse.json({ received: true, type, inserted });
}
