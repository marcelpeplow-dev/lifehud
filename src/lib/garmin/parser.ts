import Papa from "papaparse";
import { format, subDays, parseISO } from "date-fns";
import type { DeviceImportData } from "@/types/index";

export type { DeviceImportData as GarminImportData };

export interface GarminSleepRow {
  date: string;
  bedtime: string | null;
  wake_time: string | null;
  duration_minutes: number | null;
  deep_sleep_minutes: number | null;
  rem_sleep_minutes: number | null;
  light_sleep_minutes: number | null;
  awake_minutes: number | null;
  sleep_score: number | null;
}

export interface GarminWorkoutRow {
  date: string;
  started_at: string | null;
  duration_minutes: number | null;
  workout_type: "strength" | "cardio" | "flexibility" | "sport" | "other";
  activity_name: string | null;
  calories_burned: number | null;
  avg_heart_rate: number | null;
  max_heart_rate: number | null;
  distance_meters: number | null;
}

export interface GarminMetricsRow {
  date: string;
  steps: number | null;
  resting_heart_rate: number | null;
  stress_score: number | null;
  calories_total: number | null;
  calories_active: number | null;
}

// GarminImportData is now an alias for DeviceImportData (exported above)

// ─── HELPERS ──────────────────────────────────────────────────────────────────

const CUTOFF = format(subDays(new Date(), 30), "yyyy-MM-dd");

function within30Days(date: string): boolean {
  return date >= CUTOFF;
}

/** "H:MM:SS" or "HH:MM:SS" → minutes */
function durationToMinutes(val: string | undefined): number | null {
  if (!val) return null;
  const parts = val.trim().split(":").map(Number);
  if (parts.some(isNaN)) return null;
  if (parts.length === 3) return Math.round(parts[0] * 60 + parts[1] + parts[2] / 60);
  if (parts.length === 2) return parts[0] * 60 + parts[1];
  return null;
}

function num(val: string | undefined): number | null {
  if (!val) return null;
  const n = parseFloat(val.replace(/[^\d.-]/g, ""));
  return isNaN(n) ? null : n;
}

/** "YYYY-MM-DD HH:MM:SS" or "YYYY-MM-DD" → "YYYY-MM-DD" */
function isoDate(val: string | undefined): string | null {
  if (!val) return null;
  const d = val.trim().slice(0, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(d) ? d : null;
}

function isoTimestamp(val: string | undefined): string | null {
  if (!val) return null;
  try {
    const d = new Date(val.trim());
    return isNaN(d.getTime()) ? null : d.toISOString();
  } catch {
    return null;
  }
}

function mapWorkoutType(
  garminType: string
): GarminWorkoutRow["workout_type"] {
  const t = garminType.toLowerCase();
  if (
    t.includes("run") || t.includes("cycl") || t.includes("bik") ||
    t.includes("swim") || t.includes("hike") || t.includes("walk") ||
    t.includes("cardio") || t.includes("hiit") || t.includes("ellip") ||
    t.includes("rowing") || t.includes("stair") || t.includes("ski") ||
    t.includes("aerobic") || t.includes("snowboard")
  ) return "cardio";
  if (
    t.includes("strength") || t.includes("weight") ||
    t.includes("functional") || t.includes("resistance")
  ) return "strength";
  if (
    t.includes("yoga") || t.includes("pilates") ||
    t.includes("stretch") || t.includes("flexib")
  ) return "flexibility";
  if (
    t.includes("tennis") || t.includes("golf") || t.includes("soccer") ||
    t.includes("football") || t.includes("basketball") ||
    t.includes("volleyball") || t.includes("sport")
  ) return "sport";
  return "other";
}

// ─── CSV PARSERS ──────────────────────────────────────────────────────────────

function parseSleep(csv: string): GarminSleepRow[] {
  const { data } = Papa.parse<Record<string, string>>(csv, {
    header: true,
    skipEmptyLines: true,
  });

  return data.flatMap((row) => {
    // Garmin "Sleep Date" is the wake-up date; subtract 1 day for bedtime date
    const wakeDate = isoDate(row["Sleep Date"] ?? row["Date"]);
    if (!wakeDate) return [];
    const date = format(subDays(parseISO(wakeDate), 1), "yyyy-MM-dd");
    if (!within30Days(date)) return [];

    const scoreRaw = num(row["Overall Sleep Score"]);

    return [{
      date,
      bedtime: isoTimestamp(row["Bedtime Start"]),
      wake_time: isoTimestamp(row["Bedtime End"]),
      duration_minutes: durationToMinutes(row["Duration"]),
      deep_sleep_minutes: durationToMinutes(row["Deep Sleep"]),
      rem_sleep_minutes: durationToMinutes(row["REM Sleep"]),
      light_sleep_minutes: durationToMinutes(row["Light Sleep"]),
      awake_minutes: durationToMinutes(row["Awake"]),
      sleep_score: scoreRaw != null && scoreRaw > 0 ? Math.round(scoreRaw) : null,
    }];
  });
}

function parseActivities(csv: string): GarminWorkoutRow[] {
  const { data } = Papa.parse<Record<string, string>>(csv, {
    header: true,
    skipEmptyLines: true,
  });

  return data.flatMap((row) => {
    const date = isoDate(row["Date"]);
    if (!date || !within30Days(date)) return [];

    const activityType = row["Activity Type"]?.trim() ?? "";
    if (!activityType || activityType === "Activity Type") return [];

    // Distance: Garmin exports in km — convert to metres
    const distKm = num(row["Distance"]);
    const distance_meters = distKm != null && distKm > 0
      ? Math.round(distKm * 1000)
      : null;

    return [{
      date,
      started_at: isoTimestamp(row["Date"]),
      duration_minutes: durationToMinutes(row["Time"] ?? row["Elapsed Time"] ?? row["Duration"]),
      workout_type: mapWorkoutType(activityType),
      activity_name: row["Title"]?.trim() || activityType || null,
      calories_burned: num(row["Calories"]),
      avg_heart_rate: num(row["Avg HR"]),
      max_heart_rate: num(row["Max HR"]),
      distance_meters,
    }];
  });
}

function parseDailyMetrics(csv: string): GarminMetricsRow[] {
  const { data } = Papa.parse<Record<string, string>>(csv, {
    header: true,
    skipEmptyLines: true,
  });

  return data.flatMap((row) => {
    const date = isoDate(row["Date"]);
    if (!date || !within30Days(date)) return [];

    const stressRaw = num(row["Stress (avg)"] ?? row["Avg Stress"]);
    // Garmin uses -1 / -2 when no stress data available
    const stress_score = stressRaw != null && stressRaw >= 0 ? stressRaw : null;

    return [{
      date,
      steps: num(row["Steps"]),
      resting_heart_rate: num(row["Resting Heart Rate"]),
      stress_score,
      calories_total: num(row["Calories Burned"] ?? row["Total Calories"]),
      calories_active: num(row["Active Calories"]),
    }];
  });
}

// ─── MAIN ENTRY POINT ─────────────────────────────────────────────────────────

export async function parseGarminZip(file: File): Promise<DeviceImportData> {
  const JSZip = (await import("jszip")).default;
  const zip = await JSZip.loadAsync(file);

  let sleepCsv: string | null = null;
  let activitiesCsv: string | null = null;
  let metricsCsv: string | null = null;

  for (const path of Object.keys(zip.files)) {
    const lower = path.toLowerCase();
    if (lower.includes("sleepdata") && lower.endsWith(".csv")) {
      sleepCsv = await zip.files[path].async("string");
    } else if (lower.includes("summarizedactivities") && lower.endsWith(".csv")) {
      activitiesCsv = await zip.files[path].async("string");
    } else if (lower.includes("dailysummaries") && lower.endsWith(".csv")) {
      metricsCsv = await zip.files[path].async("string");
    }
  }

  if (!sleepCsv && !activitiesCsv && !metricsCsv) {
    throw new Error(
      "No Garmin CSV files found. Expected sleepData.csv, summarizedActivities.csv, or dailySummaries.csv inside the zip."
    );
  }

  return {
    sleep: sleepCsv ? parseSleep(sleepCsv) : [],
    workouts: activitiesCsv ? parseActivities(activitiesCsv) : [],
    metrics: metricsCsv ? parseDailyMetrics(metricsCsv) : [],
  };
}
