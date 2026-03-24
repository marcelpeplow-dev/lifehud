import Papa from "papaparse";
import { format, subDays, parseISO } from "date-fns";
import type { DeviceImportData, ImportSleepRow, ImportWorkoutRow, ImportMetricsRow } from "@/types/index";

export type { DeviceImportData as GarminImportData };

// Re-export row types used by tests / other modules
export type GarminSleepRow = ImportSleepRow;
export type GarminWorkoutRow = ImportWorkoutRow;
export type GarminMetricsRow = ImportMetricsRow;

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

/** Millisecond epoch → ISO timestamp string */
function msToIso(ms: number | undefined | null): string | null {
  if (ms == null || ms <= 0) return null;
  try {
    return new Date(ms).toISOString();
  } catch {
    return null;
  }
}

/** Seconds → rounded minutes */
function secsToMins(secs: number | undefined | null): number | null {
  if (secs == null || secs < 0) return null;
  return Math.round(secs / 60);
}

/** Milliseconds → rounded minutes */
function msToMins(ms: number | undefined | null): number | null {
  if (ms == null || ms <= 0) return null;
  return Math.round(ms / 60000);
}

function numOrNull(val: unknown): number | null {
  if (val == null) return null;
  const n = typeof val === "number" ? val : parseFloat(String(val));
  return isNaN(n) ? null : n;
}

function mapWorkoutType(
  garminType: string
): ImportWorkoutRow["workout_type"] {
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

// ─── FORMAT 1: ACTIVITIES CSV (from Garmin Connect Activities page) ──────────

function parseActivitiesCsv(csv: string): ImportWorkoutRow[] {
  const { data } = Papa.parse<Record<string, string>>(csv, {
    header: true,
    skipEmptyLines: true,
  });

  return data.flatMap((row) => {
    const date = isoDate(row["Date"]);
    if (!date || !within30Days(date)) return [];

    const activityType = row["Activity Type"]?.trim() ?? "";
    if (!activityType || activityType === "Activity Type") return [];

    // Distance: Garmin Activities CSV exports in km → convert to metres
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

// ─── FORMAT 2: GDPR ZIP (from garmin.com/account/datamanagement) ─────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type JsonRecord = Record<string, any>;

/**
 * Find all files in the zip matching a predicate, read and parse as JSON.
 * Garmin GDPR JSON files are sometimes a single array, sometimes a single object.
 * We always return a flat array of records.
 */
async function readJsonFiles(
  zip: import("jszip"),
  matchFn: (path: string) => boolean
): Promise<JsonRecord[]> {
  const results: JsonRecord[] = [];
  for (const path of Object.keys(zip.files)) {
    if (zip.files[path].dir) continue;
    if (!matchFn(path)) continue;
    try {
      const text = await zip.files[path].async("string");
      const parsed = JSON.parse(text);
      if (Array.isArray(parsed)) {
        results.push(...parsed);
      } else if (parsed && typeof parsed === "object") {
        // Some files wrap data in a top-level array property
        const arrayKey = Object.keys(parsed).find((k) => Array.isArray(parsed[k]));
        if (arrayKey) {
          results.push(...parsed[arrayKey]);
        } else {
          results.push(parsed);
        }
      }
    } catch {
      // Skip unparseable files
    }
  }
  return results;
}

function parseSleepJson(records: JsonRecord[]): ImportSleepRow[] {
  return records.flatMap((r) => {
    // calendarDate is the wake-up date; subtract 1 day for the "night of" date
    const wakeDate = isoDate(r.calendarDate);
    if (!wakeDate) return [];
    const date = format(subDays(parseISO(wakeDate), 1), "yyyy-MM-dd");
    if (!within30Days(date)) return [];

    const deepSecs = numOrNull(r.deepSleepSeconds);
    const lightSecs = numOrNull(r.lightSleepSeconds);
    const remSecs = numOrNull(r.remSleepSeconds);
    const awakeSecs = numOrNull(r.awakeSleepSeconds);

    // Total duration from stages, or from timestamps
    let duration_minutes: number | null = null;
    const totalSecs = [deepSecs, lightSecs, remSecs, awakeSecs]
      .filter((v): v is number => v != null)
      .reduce((a, b) => a + b, 0);
    if (totalSecs > 0) {
      duration_minutes = Math.round(totalSecs / 60);
    } else {
      const start = numOrNull(r.sleepStartTimestampGMT);
      const end = numOrNull(r.sleepEndTimestampGMT);
      if (start && end && end > start) {
        duration_minutes = Math.round((end - start) / 60000);
      }
    }

    // Sleep score: try multiple known field paths
    let sleepScore: number | null = null;
    if (r.sleepScores?.overall != null) {
      sleepScore = numOrNull(r.sleepScores.overall);
    } else if (r.overallSleepScore?.value != null) {
      sleepScore = numOrNull(r.overallSleepScore.value);
    } else if (r.sleepScores?.overallScore != null) {
      sleepScore = numOrNull(r.sleepScores.overallScore);
    }

    return [{
      date,
      bedtime: msToIso(numOrNull(r.sleepStartTimestampGMT)),
      wake_time: msToIso(numOrNull(r.sleepEndTimestampGMT)),
      duration_minutes,
      deep_sleep_minutes: secsToMins(deepSecs),
      rem_sleep_minutes: secsToMins(remSecs),
      light_sleep_minutes: secsToMins(lightSecs),
      awake_minutes: secsToMins(awakeSecs),
      sleep_score: sleepScore != null && sleepScore > 0 ? Math.round(sleepScore) : null,
      avg_heart_rate: numOrNull(r.avgHeartRate),
      avg_hrv: numOrNull(r.avgSleepStress), // closest HRV-adjacent metric in sleep JSON
    }];
  });
}

function parseDailyMetricsJson(records: JsonRecord[]): ImportMetricsRow[] {
  return records.flatMap((r) => {
    const date = isoDate(r.calendarDate);
    if (!date || !within30Days(date)) return [];

    // Stress: Garmin stores averageStressLevel or in nested stressData
    let stressScore: number | null = numOrNull(r.averageStressLevel);
    if (stressScore == null && r.stressData) {
      stressScore = numOrNull(r.stressData.avgStressLevel);
    }
    // Garmin uses -1 / -2 when no stress data
    if (stressScore != null && stressScore < 0) stressScore = null;

    const moderateMins = numOrNull(r.moderateIntensityMinutes) ?? 0;
    const vigorousMins = numOrNull(r.vigorousIntensityMinutes) ?? 0;
    const activeMins = moderateMins + vigorousMins;

    return [{
      date,
      steps: numOrNull(r.totalSteps),
      resting_heart_rate: numOrNull(r.restingHeartRate),
      stress_score: stressScore,
      calories_total: numOrNull(r.totalCalories),
      calories_active: numOrNull(r.activeCalories),
      active_minutes: activeMins > 0 ? activeMins : null,
    }];
  });
}

function parseActivitiesJson(records: JsonRecord[]): ImportWorkoutRow[] {
  // The summarizedActivities JSON can have a nested structure:
  // [{ summarizedActivitiesExport: [...] }] or just a flat array of activities
  const flat: JsonRecord[] = [];
  for (const r of records) {
    if (Array.isArray(r.summarizedActivitiesExport)) {
      flat.push(...r.summarizedActivitiesExport);
    } else {
      flat.push(r);
    }
  }

  return flat.flatMap((r) => {
    // startTimeLocal can be a string timestamp or ms epoch
    let date: string | null = null;
    let started_at: string | null = null;

    if (typeof r.startTimeLocal === "string") {
      date = isoDate(r.startTimeLocal);
      started_at = isoTimestamp(r.startTimeLocal);
    } else if (typeof r.startTimeLocal === "number") {
      started_at = msToIso(r.startTimeLocal);
      date = started_at ? started_at.slice(0, 10) : null;
    }
    // Fallback to startTimeGmt
    if (!date && typeof r.startTimeGmt === "string") {
      date = isoDate(r.startTimeGmt);
      started_at = isoTimestamp(r.startTimeGmt);
    } else if (!date && typeof r.startTimeGmt === "number") {
      started_at = msToIso(r.startTimeGmt);
      date = started_at ? started_at.slice(0, 10) : null;
    }

    if (!date || !within30Days(date)) return [];

    const activityType = r.activityType ?? r.sportType ?? r.name ?? "";
    const typeStr = typeof activityType === "string"
      ? activityType
      : activityType?.typeKey ?? String(activityType);

    // Distance is already in meters in the JSON export
    const dist = numOrNull(r.distance);

    return [{
      date,
      started_at,
      duration_minutes: msToMins(numOrNull(r.duration)),
      workout_type: mapWorkoutType(typeStr),
      activity_name: r.name?.trim() || typeStr || null,
      calories_burned: numOrNull(r.calories),
      avg_heart_rate: numOrNull(r.avgHr),
      max_heart_rate: numOrNull(r.maxHr),
      distance_meters: dist != null && dist > 0 ? Math.round(dist) : null,
    }];
  });
}

/**
 * Detect whether a zip is a Garmin GDPR export by looking for the
 * DI_CONNECT folder or known JSON file patterns.
 */
function isGdprZip(filePaths: string[]): boolean {
  return filePaths.some((p) => {
    const lower = p.toLowerCase();
    return (
      lower.includes("di_connect/") ||
      lower.includes("di-connect-wellness") ||
      lower.includes("di-connect-fitness") ||
      lower.includes("_sleepdata.json") ||
      lower.includes("udsfile_") ||
      lower.includes("_summarizedactivities.json")
    );
  });
}

async function parseGdprZip(zip: import("jszip")): Promise<DeviceImportData> {
  // Sleep: *_sleepData.json in DI-Connect-Wellness or anywhere
  const sleepRecords = await readJsonFiles(zip, (p) => {
    const lower = p.toLowerCase();
    return lower.endsWith("_sleepdata.json") || lower.endsWith("sleepdata.json");
  });

  // Daily summaries: UDSFile_*.json in DI-Connect-Wellness or anywhere
  const dailyRecords = await readJsonFiles(zip, (p) => {
    const lower = p.toLowerCase();
    return lower.includes("udsfile_") && lower.endsWith(".json");
  });

  // Activities: *_summarizedActivities.json in DI-Connect-Fitness or anywhere
  const activityRecords = await readJsonFiles(zip, (p) => {
    const lower = p.toLowerCase();
    return lower.endsWith("_summarizedactivities.json") || lower.endsWith("summarizedactivities.json");
  });

  return {
    sleep: parseSleepJson(sleepRecords),
    workouts: parseActivitiesJson(activityRecords),
    metrics: parseDailyMetricsJson(dailyRecords),
  };
}

// ─── MAIN ENTRY POINTS ──────────────────────────────────────────────────────

/**
 * Parse a single CSV file from the Garmin Connect Activities page export.
 * Returns workouts only (sleep/metrics not available via CSV).
 */
export async function parseGarminActivitiesCsv(file: File): Promise<DeviceImportData> {
  const text = await file.text();
  const workouts = parseActivitiesCsv(text);

  if (workouts.length === 0) {
    throw new Error(
      "No activity records found in the CSV. Make sure you exported from Garmin Connect → Activities → Export CSV."
    );
  }

  return {
    sleep: [],
    workouts,
    metrics: [],
  };
}

/**
 * Parse a Garmin zip export. Auto-detects:
 * - GDPR full export (DI_CONNECT folder with JSON files)
 * - Legacy CSV zip (for backwards compatibility)
 */
export async function parseGarminZip(file: File): Promise<DeviceImportData> {
  const JSZip = (await import("jszip")).default;
  const zip = await JSZip.loadAsync(file);
  const paths = Object.keys(zip.files);

  // Auto-detect: GDPR export vs legacy CSV zip
  if (isGdprZip(paths)) {
    return parseGdprZip(zip);
  }

  // Fallback: legacy CSV-based zip (backwards compatibility)
  let activitiesCsv: string | null = null;
  for (const path of paths) {
    const lower = path.toLowerCase();
    if (
      (lower.includes("summarizedactivities") || lower.includes("activities")) &&
      lower.endsWith(".csv")
    ) {
      activitiesCsv = await zip.files[path].async("string");
      break;
    }
  }

  if (!activitiesCsv) {
    throw new Error(
      "Unrecognized zip format. Expected a Garmin GDPR data export (from garmin.com → Account → Data Management → Export Your Data)."
    );
  }

  return {
    sleep: [],
    workouts: parseActivitiesCsv(activitiesCsv),
    metrics: [],
  };
}

/**
 * Universal entry point — auto-detects file type (.csv vs .zip) and format.
 */
export async function parseGarminExport(file: File): Promise<DeviceImportData> {
  const name = file.name.toLowerCase();

  if (name.endsWith(".csv")) {
    return parseGarminActivitiesCsv(file);
  }

  if (name.endsWith(".zip")) {
    return parseGarminZip(file);
  }

  throw new Error(
    "Unsupported file type. Upload a .csv (Activities export) or .zip (full data export from Garmin)."
  );
}
