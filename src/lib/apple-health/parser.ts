import Papa from "papaparse";
import {
  parseISO,
  subDays,
  startOfDay,
  isAfter,
  format,
  differenceInMinutes,
} from "date-fns";
import type { DeviceImportData } from "@/types/index";

// ---------------------------------------------------------------------------
// Private helpers
// ---------------------------------------------------------------------------

function num(v: string | undefined): number | null {
  if (v == null || v.trim() === "") return null;
  const cleaned = v.replace(/[^\d.\-]/g, "");
  const n = parseFloat(cleaned);
  return isNaN(n) ? null : n;
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

function isoTimestamp(v: string | undefined): string | null {
  if (v == null || v.trim() === "") return null;
  const trimmed = v.trim();
  // Handle "2024-01-15 10:30:00 -0500" → "2024-01-15T10:30:00-0500"
  // Replace space between date and time with "T", then strip extra space before timezone
  const normalized = trimmed
    .replace(/^(\d{4}-\d{2}-\d{2}) (\d{2}:\d{2}:\d{2}) ([+-]\d{4})$/, "$1T$2$3")
    .replace(/^(\d{4}-\d{2}-\d{2}) (\d{2}:\d{2}:\d{2})$/, "$1T$2");
  try {
    let d: Date;
    // Try parseISO first (handles standard ISO strings)
    d = parseISO(normalized);
    if (!isNaN(d.getTime())) return d.toISOString();
    // Fallback to Date constructor
    d = new Date(trimmed);
    if (!isNaN(d.getTime())) return d.toISOString();
    return null;
  } catch {
    return null;
  }
}

function dateFromTimestamp(v: string | undefined): string | null {
  const iso = isoTimestamp(v);
  if (!iso) return null;
  return iso.slice(0, 10);
}

function hoursToMinutes(v: string | undefined): number | null {
  if (v == null || v.trim() === "") return null;
  const trimmed = v.trim();
  const hasHr = /hr/i.test(trimmed);
  const n = num(trimmed);
  if (n == null) return null;
  if (hasHr) {
    // Explicit hours notation
    return n * 60;
  }
  // Heuristic: if value > 24 assume already in minutes; if <= 24 assume hours
  if (n > 24) return n;
  return n * 60;
}

function mapWorkoutType(
  name: string
): "strength" | "cardio" | "flexibility" | "sport" | "other" {
  // Strip Apple Health "HKWorkoutActivityType" prefix
  const stripped = name.replace(/^HKWorkoutActivityType/i, "");
  const lower = stripped.toLowerCase();

  if (
    /running|run|cycl|bik|swimming|swim|hike|walking|walk|cardio|hiit|ellip|rowing|stair|ski|aerobic|snowboard/.test(
      lower
    )
  )
    return "cardio";
  if (
    /traditionalstrengthtraining|functionalstrengthtraining|strength|weight|functional|resistance/.test(
      lower
    )
  )
    return "strength";
  if (/yoga|pilates|stretch|flexib/.test(lower)) return "flexibility";
  if (/tennis|golf|soccer|football|basketball|volleyball|sport/.test(lower))
    return "sport";
  return "other";
}

function sleepNightDate(ts: string): string {
  const iso = isoTimestamp(ts);
  if (!iso) return ts.slice(0, 10);
  const d = new Date(iso);
  if (isNaN(d.getTime())) return ts.slice(0, 10);
  const hour = d.getHours();
  if (hour < 12) {
    // Subtract 1 day — this is the "previous night"
    const prev = subDays(d, 1);
    return format(prev, "yyyy-MM-dd");
  }
  return format(d, "yyyy-MM-dd");
}

// ---------------------------------------------------------------------------
// Row type definitions
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
  calories_burned: number | null;
  distance_meters: number | null;
};

type StepsRow = {
  date: string;
  steps: number;
};

type HRRow = {
  date: string;
  resting_heart_rate: number;
};

type MetricsRow = {
  date: string;
  steps?: number | null;
  resting_heart_rate?: number | null;
};

// ---------------------------------------------------------------------------
// Private parser functions
// ---------------------------------------------------------------------------

function parseSleepCsv(csv: string): SleepRow[] {
  const result = Papa.parse<Record<string, string>>(csv, {
    header: true,
    skipEmptyLines: true,
  });
  if (result.data.length === 0) return [];

  const headers = result.meta.fields ?? [];

  // Detect format:
  // Format A: has aggregate stage columns ("In Bed" or "Asleep") — no "Value" with stage strings
  // Format B: has "Value" column containing sleep stage strings
  const hasValueCol = headers.includes("Value");
  const isFormatB =
    hasValueCol &&
    result.data.some((row) => {
      const v = row["Value"];
      return (
        v === "InBed" ||
        v === "Asleep" ||
        v === "Core" ||
        v === "Deep" ||
        v === "REM" ||
        v === "Awake"
      );
    });

  if (!isFormatB) {
    // Format A: aggregate columns
    const rows: SleepRow[] = [];
    for (const row of result.data) {
      const startRaw = row["Start"] ?? undefined;
      const finishRaw = row["Finish"] ?? undefined;
      if (!startRaw) continue;
      const bedtime = isoTimestamp(startRaw);
      const wake_time = isoTimestamp(finishRaw);
      const date = sleepNightDate(startRaw);
      if (!within30Days(date)) continue;

      const inBedRaw =
        row["In Bed"] ?? row["Asleep"] ?? undefined;
      const deepRaw =
        row["Deep"] ?? row["Deep Sleep"] ?? undefined;
      const remRaw = row["REM"] ?? undefined;
      const lightRaw =
        row["Core"] ?? row["Light Sleep"] ?? undefined;

      rows.push({
        date,
        bedtime,
        wake_time,
        duration_minutes: hoursToMinutes(inBedRaw),
        deep_sleep_minutes: hoursToMinutes(deepRaw),
        rem_sleep_minutes: hoursToMinutes(remRaw),
        light_sleep_minutes: hoursToMinutes(lightRaw),
        awake_minutes: null,
        sleep_score: null,
      });
    }
    return rows;
  }

  // Format B: interval rows — group by sleep night date
  type IntervalRow = {
    start: string;
    finish: string;
    value: string;
  };

  const intervals: IntervalRow[] = [];
  for (const row of result.data) {
    const start =
      row["Start"] ?? row["Start Date"] ?? undefined;
    const finish =
      row["Finish"] ?? row["End Date"] ?? undefined;
    const value = row["Value"] ?? "";
    if (!start || !finish) continue;
    intervals.push({ start, finish, value });
  }

  // Group by night date
  const nightMap = new Map<string, IntervalRow[]>();
  for (const interval of intervals) {
    const nightDate = sleepNightDate(interval.start);
    const arr = nightMap.get(nightDate) ?? [];
    arr.push(interval);
    nightMap.set(nightDate, arr);
  }

  const rows: SleepRow[] = [];
  for (const [date, nightRows] of nightMap.entries()) {
    if (!within30Days(date)) continue;

    // bedtime = min start, wake_time = max finish
    let minStart: Date | null = null;
    let maxFinish: Date | null = null;

    let deepMinutes = 0;
    let remMinutes = 0;
    let lightMinutes = 0;
    let awakeMinutes = 0;
    let inBedMinutes = 0;

    for (const r of nightRows) {
      const startIso = isoTimestamp(r.start);
      const finishIso = isoTimestamp(r.finish);
      if (!startIso || !finishIso) continue;
      const startDate = new Date(startIso);
      const finishDate = new Date(finishIso);
      const durationMin = differenceInMinutes(finishDate, startDate);

      if (minStart == null || startDate < minStart) minStart = startDate;
      if (maxFinish == null || finishDate > maxFinish) maxFinish = finishDate;

      const v = r.value;
      if (v === "Deep") deepMinutes += durationMin;
      else if (v === "REM") remMinutes += durationMin;
      else if (v === "Core" || v === "Asleep") lightMinutes += durationMin;
      else if (v === "Awake") awakeMinutes += durationMin;
      else if (v === "InBed") inBedMinutes += durationMin;
    }

    const totalSleep = deepMinutes + remMinutes + lightMinutes;
    const duration_minutes =
      inBedMinutes > 0 ? inBedMinutes : totalSleep > 0 ? totalSleep : null;

    rows.push({
      date,
      bedtime: minStart ? minStart.toISOString() : null,
      wake_time: maxFinish ? maxFinish.toISOString() : null,
      duration_minutes,
      deep_sleep_minutes: deepMinutes > 0 ? deepMinutes : null,
      rem_sleep_minutes: remMinutes > 0 ? remMinutes : null,
      light_sleep_minutes: lightMinutes > 0 ? lightMinutes : null,
      awake_minutes: awakeMinutes > 0 ? awakeMinutes : null,
      sleep_score: null,
    });
  }
  return rows;
}

function parseStepsCsv(csv: string): StepsRow[] {
  const result = Papa.parse<Record<string, string>>(csv, {
    header: true,
    skipEmptyLines: true,
  });

  const headers = result.meta.fields ?? [];

  // Find the value column
  const valueCol =
    headers.find((h) => h === "Steps (count)") ??
    headers.find((h) => h === "Steps") ??
    headers.find((h) => h === "Value") ??
    headers.find((h) => h === "Quantity");

  const dateMap = new Map<string, number>();
  for (const row of result.data) {
    const dateRaw = row["Start"] ?? row["Date"] ?? undefined;
    const date = dateFromTimestamp(dateRaw);
    if (!date) continue;
    if (!within30Days(date)) continue;
    if (!valueCol) continue;
    const val = num(row[valueCol] ?? undefined);
    if (val == null) continue;
    dateMap.set(date, (dateMap.get(date) ?? 0) + val);
  }

  const rows: StepsRow[] = [];
  for (const [date, steps] of dateMap.entries()) {
    rows.push({ date, steps: Math.round(steps) });
  }
  return rows;
}

function parseHeartRateCsv(csv: string): HRRow[] {
  const result = Papa.parse<Record<string, string>>(csv, {
    header: true,
    skipEmptyLines: true,
  });

  const headers = result.meta.fields ?? [];

  const valueCol =
    headers.find((h) => h === "Heart Rate (count/min)") ??
    headers.find((h) => h === "Heart Rate") ??
    headers.find((h) => h === "BPM") ??
    headers.find((h) => h === "Value") ??
    headers.find((h) => h === "Quantity");

  const dateMap = new Map<string, number[]>();
  for (const row of result.data) {
    const dateRaw = row["Start"] ?? row["Date"] ?? undefined;
    const date = dateFromTimestamp(dateRaw);
    if (!date) continue;
    if (!within30Days(date)) continue;
    if (!valueCol) continue;
    const val = num(row[valueCol] ?? undefined);
    if (val == null) continue;
    const arr = dateMap.get(date) ?? [];
    arr.push(val);
    dateMap.set(date, arr);
  }

  const rows: HRRow[] = [];
  for (const [date, values] of dateMap.entries()) {
    const avg = values.reduce((a, b) => a + b, 0) / values.length;
    rows.push({ date, resting_heart_rate: Math.round(avg) });
  }
  return rows;
}

function parseWorkoutsCsv(csv: string): WorkoutRow[] {
  const result = Papa.parse<Record<string, string>>(csv, {
    header: true,
    skipEmptyLines: true,
  });

  const headers = result.meta.fields ?? [];

  const activityCol =
    headers.find((h) => h === "Workout Activity Type") ??
    headers.find((h) => h === "Activity Type") ??
    headers.find((h) => h === "Type");

  const durationCol =
    headers.find((h) => h === "Duration (min)") ??
    headers.find((h) => h === "Duration");

  const caloriesCol =
    headers.find((h) => h === "Active Energy Burned (kcal)") ??
    headers.find((h) => h === "Active Energy Burned") ??
    headers.find((h) => h === "Calories");

  const distanceMetersCol =
    headers.find((h) => h === "Total Distance (m)") ??
    headers.find((h) => h === "Distance (m)");

  const distanceMiCol = headers.find((h) => h === "Total Distance (mi)");

  const rows: WorkoutRow[] = [];
  for (const row of result.data) {
    const startRaw = row["Start"] ?? undefined;
    const finishRaw = row["Finish"] ?? undefined;
    const started_at = isoTimestamp(startRaw);
    const date = dateFromTimestamp(startRaw);
    if (!date) continue;
    if (!within30Days(date)) continue;

    const activityName = activityCol ? (row[activityCol] ?? "Unknown") : "Unknown";

    // Duration: prefer explicit column, otherwise compute from Start/Finish diff
    let duration_minutes: number | null = null;
    if (durationCol) {
      duration_minutes = num(row[durationCol] ?? undefined);
    }
    if (duration_minutes == null && started_at && finishRaw) {
      const finishIso = isoTimestamp(finishRaw);
      if (finishIso) {
        duration_minutes = differenceInMinutes(
          new Date(finishIso),
          new Date(started_at)
        );
      }
    }

    // Distance
    let distance_meters: number | null = null;
    if (distanceMetersCol) {
      distance_meters = num(row[distanceMetersCol] ?? undefined);
    } else if (distanceMiCol) {
      const mi = num(row[distanceMiCol] ?? undefined);
      if (mi != null) distance_meters = mi * 1609.344;
    }

    rows.push({
      date,
      started_at,
      activity_name: activityName,
      workout_type: mapWorkoutType(activityName),
      duration_minutes,
      calories_burned: caloriesCol ? num(row[caloriesCol] ?? undefined) : null,
      distance_meters,
    });
  }
  return rows;
}

// ---------------------------------------------------------------------------
// Main export
// ---------------------------------------------------------------------------

export async function parseAppleHealth(files: File[]): Promise<DeviceImportData> {
  let sleep: SleepRow[] = [];
  const workouts: WorkoutRow[] = [];
  const stepRows: StepsRow[] = [];
  const hrRows: HRRow[] = [];
  let matched = false;

  for (const file of files) {
    const filename = file.name.toLowerCase();
    const csv = await file.text();

    if (filename.includes("sleep")) {
      matched = true;
      sleep = [...sleep, ...parseSleepCsv(csv)];
    } else if (filename.includes("step")) {
      matched = true;
      stepRows.push(...parseStepsCsv(csv));
    } else if (filename.includes("heart_rate") || filename.includes("heart")) {
      matched = true;
      hrRows.push(...parseHeartRateCsv(csv));
    } else if (filename.includes("workout")) {
      matched = true;
      workouts.push(...parseWorkoutsCsv(csv));
    }
    // Otherwise: skip
  }

  if (!matched) {
    throw new Error(
      "No Apple Health CSV files recognized. Expected Sleep Analysis.csv, Steps.csv, Heart Rate.csv, or Workouts.csv."
    );
  }

  // Merge steps and heart rate into metrics by date
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
  addMetrics(stepRows);
  addMetrics(hrRows);

  const metrics: MetricsRow[] = (
    [...metricsMap.values()] as MetricsRow[]
  );

  return { sleep, workouts, metrics };
}
