import Papa from "papaparse";
import { parseISO, subDays, startOfDay, isAfter, format, parse } from "date-fns";
import type { DeviceImportData } from "@/types/index";

export type { DeviceImportData as FitbitImportData };

// ---------------------------------------------------------------------------
// Private helpers
// ---------------------------------------------------------------------------

function num(v: string | undefined): number | null {
  if (v == null || v.trim() === "") return null;
  const cleaned = v.replace(/[^\d.\-]/g, "");
  const n = parseFloat(cleaned);
  return isNaN(n) ? null : n;
}

function durationToMinutes(v: string | undefined): number | null {
  if (v == null || v.trim() === "") return null;
  // Format: "H:MM:SS" or "HH:MM:SS"
  const match = v.trim().match(/^(\d+):(\d{2}):(\d{2})$/);
  if (!match) return null;
  const hours = parseInt(match[1], 10);
  const minutes = parseInt(match[2], 10);
  const seconds = parseInt(match[3], 10);
  return hours * 60 + minutes + seconds / 60;
}

function isoTimestamp(v: string | undefined): string | null {
  if (v == null || v.trim() === "") return null;
  // Handle Fitbit format "2024-01-15 22:30:00"
  const trimmed = v.trim();
  // Replace space between date and time with "T" for ISO parsing
  const normalized = trimmed.replace(/^(\d{4}-\d{2}-\d{2}) (\d{2}:\d{2}:\d{2})$/, "$1T$2");
  try {
    const d = parseISO(normalized);
    if (isNaN(d.getTime())) return null;
    return d.toISOString();
  } catch {
    return null;
  }
}

function dateFromTimestamp(v: string | undefined): string | null {
  const iso = isoTimestamp(v);
  if (!iso) return null;
  return iso.slice(0, 10);
}

function parseFitbitDate(v: string | undefined): string | null {
  if (v == null || v.trim() === "") return null;
  const trimmed = v.trim();
  // Already "YYYY-MM-DD"
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return trimmed;
  // "MM/DD/YYYY"
  if (/^\d{2}\/\d{2}\/\d{4}$/.test(trimmed)) {
    try {
      const d = parse(trimmed, "MM/dd/yyyy", new Date());
      return format(d, "yyyy-MM-dd");
    } catch {
      return null;
    }
  }
  // "MM/DD/YY"
  if (/^\d{2}\/\d{2}\/\d{2}$/.test(trimmed)) {
    try {
      const d = parse(trimmed, "MM/dd/yy", new Date());
      return format(d, "yyyy-MM-dd");
    } catch {
      return null;
    }
  }
  return null;
}

function within30Days(date: string): boolean {
  try {
    const d = parseISO(date);
    const cutoff = startOfDay(subDays(new Date(), 30));
    return isAfter(d, cutoff) || d.getTime() === cutoff.getTime();
  } catch {
    return false;
  }
}

function mapWorkoutType(
  name: string
): "strength" | "cardio" | "flexibility" | "sport" | "other" {
  const lower = name.toLowerCase();
  if (
    /run|cycl|bik|swim|hike|walk|cardio|hiit|ellip|rowing|stair|ski|aerobic|snowboard/.test(
      lower
    )
  )
    return "cardio";
  if (/strength|weight|functional|resistance/.test(lower)) return "strength";
  if (/yoga|pilates|stretch|flexib/.test(lower)) return "flexibility";
  if (/tennis|golf|soccer|football|basketball|volleyball|sport/.test(lower))
    return "sport";
  return "other";
}

// ---------------------------------------------------------------------------
// Row type helpers
// ---------------------------------------------------------------------------

type SleepRow = {
  date: string;
  bedtime: string | null;
  wake_time: string | null;
  duration_minutes: number | null;
  deep_sleep_minutes: number | null;
  rem_sleep_minutes: number | null;
  light_sleep_minutes: number | null;
  awake_minutes: number | null;
  sleep_score: null;
};

type WorkoutRow = {
  date: string;
  started_at: string | null;
  activity_name: string;
  workout_type: "strength" | "cardio" | "flexibility" | "sport" | "other";
  duration_minutes: number | null;
  avg_heart_rate: number | null;
  calories_burned: number | null;
  distance_meters: number | null;
};

type MetricsRow = {
  date: string;
  steps?: number | null;
  calories_total?: number | null;
  calories_active?: number | null;
  active_minutes?: number | null;
  resting_heart_rate?: number | null;
};

// ---------------------------------------------------------------------------
// Private parser functions
// ---------------------------------------------------------------------------

function parseSleep(csv: string): SleepRow[] {
  const result = Papa.parse<Record<string, string>>(csv, {
    header: true,
    skipEmptyLines: true,
  });
  const rows: SleepRow[] = [];
  for (const row of result.data) {
    const startRaw = row["Start Time"] ?? row["Start"] ?? undefined;
    const endRaw =
      row["End Time"] ?? row["End"] ?? row["Stop Time"] ?? undefined;

    const bedtime = isoTimestamp(startRaw);
    const wake_time = isoTimestamp(endRaw);
    // The date IS the night date — Fitbit Start Time is already the bedtime
    const date = dateFromTimestamp(startRaw);
    if (!date) continue;
    if (!within30Days(date)) continue;

    const timeInBed = row["Time in Bed"] ?? undefined;
    const deepRaw =
      row["Minutes Deep Sleep"] ?? row["Deep Sleep"] ?? undefined;
    const remRaw = row["Minutes REM Sleep"] ?? row["REM Sleep"] ?? undefined;
    const lightRaw =
      row["Minutes Light Sleep"] ?? row["Light Sleep"] ?? undefined;
    const awakeRaw = row["Minutes Awake"] ?? row["Awake"] ?? undefined;

    rows.push({
      date,
      bedtime,
      wake_time,
      duration_minutes: num(timeInBed),
      deep_sleep_minutes: num(deepRaw),
      rem_sleep_minutes: num(remRaw),
      light_sleep_minutes: num(lightRaw),
      awake_minutes: num(awakeRaw),
      sleep_score: null,
    });
  }
  return rows;
}

function parseExercise(csv: string): WorkoutRow[] {
  const result = Papa.parse<Record<string, string>>(csv, {
    header: true,
    skipEmptyLines: true,
  });
  const rows: WorkoutRow[] = [];
  for (const row of result.data) {
    const activityName =
      row["Activity Name"] ?? row["Activity"] ?? "Unknown";
    const startRaw = row["Start Time"] ?? row["Start"] ?? undefined;
    const started_at = isoTimestamp(startRaw);
    const date = dateFromTimestamp(startRaw);
    if (!date) continue;
    if (!within30Days(date)) continue;

    const durationRaw = row["Duration"] ?? undefined;
    const avgHRRaw =
      row["Average Heart Rate"] ?? row["Avg Heart Rate"] ?? undefined;
    const calRaw =
      row["Calories Burned"] ?? row["Calories"] ?? undefined;
    const distRaw = row["Distance"] ?? undefined;
    const distUnitRaw = row["Distance Unit"] ?? "";

    const distVal = num(distRaw);
    let distance_meters: number | null = null;
    if (distVal != null) {
      const unit = distUnitRaw.toLowerCase();
      if (unit === "km" || unit === "kilometers") {
        distance_meters = distVal * 1000;
      } else if (unit === "mi" || unit === "miles") {
        distance_meters = distVal * 1609.344;
      } else {
        // Unknown unit — store raw value
        distance_meters = distVal;
      }
    }

    rows.push({
      date,
      started_at,
      activity_name: activityName,
      workout_type: mapWorkoutType(activityName),
      duration_minutes: durationToMinutes(durationRaw),
      avg_heart_rate: num(avgHRRaw),
      calories_burned: num(calRaw),
      distance_meters,
    });
  }
  return rows;
}

function parseDailyActivity(csv: string): MetricsRow[] {
  const result = Papa.parse<Record<string, string>>(csv, {
    header: true,
    skipEmptyLines: true,
  });
  const rows: MetricsRow[] = [];
  for (const row of result.data) {
    const dateRaw = row["Date"] ?? row["date"] ?? undefined;
    const date = parseFitbitDate(dateRaw);
    if (!date) continue;
    if (!within30Days(date)) continue;

    const stepsRaw = row["Steps"] ?? row["steps"] ?? undefined;
    const stepVal = num(stepsRaw);

    const calTotalRaw =
      row["Calories Burned"] ?? row["Total Calories"] ?? undefined;
    const calActiveRaw =
      row["Activity Calories"] ?? row["Active Calories"] ?? undefined;

    const veryActiveRaw = row["Minutes Very Active"] ?? undefined;
    const fairlyActiveRaw = row["Minutes Fairly Active"] ?? undefined;
    const veryActive = num(veryActiveRaw) ?? 0;
    const fairlyActive = num(fairlyActiveRaw) ?? 0;
    const active_minutes =
      veryActive + fairlyActive > 0 ? veryActive + fairlyActive : null;

    rows.push({
      date,
      steps: stepVal != null ? Math.round(stepVal) : null,
      calories_total: num(calTotalRaw),
      calories_active: num(calActiveRaw),
      active_minutes,
    });
  }
  return rows;
}

function parseRestingHR(csv: string): MetricsRow[] {
  const result = Papa.parse<Record<string, string>>(csv, {
    header: true,
    skipEmptyLines: true,
  });

  const headers = result.meta.fields ?? [];

  // Format A: has "Date" and "Resting Heart Rate"
  if (
    headers.includes("Date") &&
    (headers.includes("Resting Heart Rate") ||
      headers.some((h) => h.toLowerCase().includes("resting")))
  ) {
    const rows: MetricsRow[] = [];
    for (const row of result.data) {
      const dateRaw = row["Date"] ?? undefined;
      const date = parseFitbitDate(dateRaw);
      if (!date) continue;
      if (!within30Days(date)) continue;
      const hrKey =
        headers.find((h) => h.toLowerCase().includes("resting")) ?? "";
      const resting_heart_rate = num(row[hrKey] ?? undefined);
      rows.push({ date, resting_heart_rate });
    }
    return rows;
  }

  // Format B: "Time" column with timestamps and "Value" column
  const dailyValues = new Map<string, number[]>();
  for (const row of result.data) {
    const timeRaw = row["Time"] ?? undefined;
    const date = dateFromTimestamp(timeRaw);
    if (!date) continue;
    if (!within30Days(date)) continue;
    const val = num(row["Value"] ?? undefined);
    if (val == null) continue;
    const arr = dailyValues.get(date) ?? [];
    arr.push(val);
    dailyValues.set(date, arr);
  }

  const rows: MetricsRow[] = [];
  for (const [date, values] of dailyValues.entries()) {
    const avg = values.reduce((a, b) => a + b, 0) / values.length;
    rows.push({ date, resting_heart_rate: Math.floor(avg) });
  }
  return rows;
}

// ---------------------------------------------------------------------------
// Main export
// ---------------------------------------------------------------------------

export async function parseFitbitZip(file: File): Promise<DeviceImportData> {
  const JSZip = (await import("jszip")).default;

  const arrayBuffer = await file.arrayBuffer();
  const zip = await JSZip.loadAsync(arrayBuffer);

  let sleepCsv: string | null = null;
  let exerciseCsv: string | null = null;
  let activityCsv: string | null = null;
  let hrCsv: string | null = null;

  const entries = Object.entries(zip.files);
  for (const [fullPath, zipEntry] of entries) {
    if (zipEntry.dir) continue;
    const filename = fullPath.split("/").pop()?.toLowerCase() ?? "";
    if (!filename.endsWith(".csv")) continue;

    if (filename.includes("sleep") && sleepCsv == null) {
      sleepCsv = await zipEntry.async("string");
    } else if (filename.includes("exercise") && exerciseCsv == null) {
      exerciseCsv = await zipEntry.async("string");
    } else if (
      !filename.includes("exercise") &&
      (filename.includes("steps") ||
        filename.includes("daily_activity") ||
        filename.includes("activities") ||
        filename.includes("calories")) &&
      activityCsv == null
    ) {
      activityCsv = await zipEntry.async("string");
    } else if (
      !filename.includes("sleep") &&
      !filename.includes("exercise") &&
      (filename.includes("heart_rate") ||
        filename.includes("heart") ||
        filename.includes("resting")) &&
      hrCsv == null
    ) {
      hrCsv = await zipEntry.async("string");
    }
  }

  if (
    sleepCsv == null &&
    exerciseCsv == null &&
    activityCsv == null &&
    hrCsv == null
  ) {
    throw new Error(
      "No Fitbit CSV files found. Expected sleep.csv, exercise.csv, steps.csv, or heart_rate.csv inside the zip."
    );
  }

  const sleep = sleepCsv ? parseSleep(sleepCsv) : [];
  const workouts = exerciseCsv ? parseExercise(exerciseCsv) : [];

  const metricsMap = new Map<string, Record<string, unknown>>();
  const addMetrics = (rows: object[]) => {
    for (const m of rows) {
      const row = m as Record<string, unknown>;
      const date = row.date as string;
      const existing = metricsMap.get(date) ?? { date };
      metricsMap.set(date, {
        ...existing,
        ...Object.fromEntries(
          Object.entries(row).filter(([, v]) => v != null)
        ),
      });
    }
  };
  addMetrics(activityCsv ? parseDailyActivity(activityCsv) : []);
  addMetrics(hrCsv ? parseRestingHR(hrCsv) : []);

  return {
    sleep,
    workouts,
    metrics: [...metricsMap.values()] as unknown as DeviceImportData["metrics"],
  };
}
