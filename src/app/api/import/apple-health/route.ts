import { NextResponse } from "next/server";
import AdmZip from "adm-zip";
import { createClient } from "@/lib/supabase/server";
import { parseAppleHealthXml } from "@/lib/apple-health/xml-parser";
import {
  mapAppleHealthSleep,
  mapAppleHealthMetrics,
  mapAppleHealthWorkout,
} from "@/lib/apple-health/mappers";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // ── Parse multipart upload ─────────────────────────────────────────────
    let formData: FormData;
    try {
      formData = await request.formData();
    } catch {
      return NextResponse.json(
        { error: "Please upload your Apple Health export zip file" },
        { status: 400 }
      );
    }

    const file = formData.get("file");
    if (!(file instanceof File)) {
      return NextResponse.json(
        { error: "Please upload your Apple Health export zip file" },
        { status: 400 }
      );
    }

    if (!file.name.toLowerCase().endsWith(".zip")) {
      return NextResponse.json(
        { error: "Please upload your Apple Health export zip file" },
        { status: 400 }
      );
    }

    // ── Extract export.xml from zip ────────────────────────────────────────
    const zipBuffer = Buffer.from(await file.arrayBuffer());
    let xmlBuffer: Buffer;
    try {
      const zip = new AdmZip(zipBuffer);
      // Apple Health zips contain "apple_health_export/export.xml"
      const entry =
        zip.getEntry("apple_health_export/export.xml") ??
        zip.getEntry("export.xml") ??
        zip.getEntries().find((e) => e.entryName.endsWith("export.xml"));

      if (!entry) {
        return NextResponse.json(
          {
            error:
              "This zip doesn't contain Apple Health data. Make sure you exported from the Health app.",
          },
          { status: 400 }
        );
      }
      xmlBuffer = entry.getData();
    } catch {
      return NextResponse.json(
        { error: "The export file appears to be corrupted" },
        { status: 400 }
      );
    }

    // ── Parse XML ─────────────────────────────────────────────────────────
    let parsed;
    try {
      parsed = parseAppleHealthXml(xmlBuffer, 90);
    } catch {
      return NextResponse.json(
        { error: "The export file appears to be corrupted" },
        { status: 400 }
      );
    }

    const { sleepSessions, dailyMetrics, workouts } = parsed;

    if (
      sleepSessions.length === 0 &&
      dailyMetrics.length === 0 &&
      workouts.length === 0
    ) {
      return NextResponse.json({
        success: true,
        message: "No data found in the last 90 days.",
        inserted: { sleep: 0, workouts: 0, metrics: 0 },
        dateRange: parsed.summary.dateRange,
      });
    }

    // ── Upsert sleep ───────────────────────────────────────────────────────
    let sleepCount = 0;
    if (sleepSessions.length > 0) {
      const rows = sleepSessions.map((s) =>
        mapAppleHealthSleep(user.id, s)
      );
      const { error } = await supabase
        .from("sleep_records")
        .upsert(rows, { onConflict: "user_id,date" });
      if (error) throw new Error(`Sleep upsert: ${error.message}`);
      sleepCount = rows.length;
    }

    // ── Upsert daily metrics ───────────────────────────────────────────────
    let metricsCount = 0;
    if (dailyMetrics.length > 0) {
      const rows = dailyMetrics.map((d) =>
        mapAppleHealthMetrics(user.id, d)
      );
      const { error } = await supabase
        .from("daily_metrics")
        .upsert(rows, { onConflict: "user_id,date" });
      if (error) throw new Error(`Metrics upsert: ${error.message}`);
      metricsCount = rows.length;
    }

    // ── Delete + insert workouts (no unique constraint on date) ───────────
    let workoutCount = 0;
    if (workouts.length > 0) {
      const rows = workouts.map((w) => mapAppleHealthWorkout(user.id, w));
      const dates = [...new Set(rows.map((r) => r.date))];
      await supabase
        .from("workouts")
        .delete()
        .eq("user_id", user.id)
        .eq("source", "apple_health")
        .in("date", dates);

      const { error } = await supabase.from("workouts").insert(rows);
      if (error) throw new Error(`Workout insert: ${error.message}`);
      workoutCount = rows.length;
    }

    return NextResponse.json({
      success: true,
      inserted: { sleep: sleepCount, workouts: workoutCount, metrics: metricsCount },
      dateRange: parsed.summary.dateRange,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
