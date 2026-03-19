import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import type { DeviceImportData } from "@/types/index";

const VALID_SOURCES = ["garmin_csv", "fitbit_csv", "apple_health_csv"];

export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = (await request.json()) as DeviceImportData & { source?: string };
    const { sleep = [], workouts = [], metrics = [] } = body;
    const source = VALID_SOURCES.includes(body.source ?? "") ? body.source! : "garmin_csv";

    // ── Sleep records (upsert on user_id + date) ────────────────────────────
    let sleepCount = 0;
    if (sleep.length > 0) {
      const sleepRows = sleep.map((r) => ({ ...r, user_id: user.id, source }));
      const { error } = await supabase
        .from("sleep_records")
        .upsert(sleepRows, { onConflict: "user_id,date" });
      if (error) throw new Error(`Sleep upsert: ${error.message}`);
      sleepCount = sleep.length;
    }

    // ── Workouts (delete+insert per source — no unique constraint on date) ──
    let workoutCount = 0;
    if (workouts.length > 0) {
      const dates = [...new Set(workouts.map((w) => w.date))];
      await supabase
        .from("workouts")
        .delete()
        .eq("user_id", user.id)
        .eq("source", source)
        .in("date", dates);

      const workoutRows = workouts.map((r) => ({ ...r, user_id: user.id, source }));
      const { error } = await supabase.from("workouts").insert(workoutRows);
      if (error) throw new Error(`Workout insert: ${error.message}`);
      workoutCount = workouts.length;
    }

    // ── Daily metrics (upsert on user_id + date) ────────────────────────────
    let metricsCount = 0;
    if (metrics.length > 0) {
      const metricsRows = metrics.map((r) => ({ ...r, user_id: user.id, source }));
      const { error } = await supabase
        .from("daily_metrics")
        .upsert(metricsRows, { onConflict: "user_id,date" });
      if (error) throw new Error(`Metrics upsert: ${error.message}`);
      metricsCount = metrics.length;
    }

    return NextResponse.json({
      success: true,
      inserted: { sleep: sleepCount, workouts: workoutCount, metrics: metricsCount },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
