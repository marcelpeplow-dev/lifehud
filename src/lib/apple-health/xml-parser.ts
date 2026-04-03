import sax from "sax";
import { subDays, format, differenceInMinutes } from "date-fns";

// ── Public interfaces ────────────────────────────────────────────────────────

export interface AppleHealthParseResult {
  sleepSessions: ParsedSleepSession[];
  dailyMetrics: ParsedDailyMetrics[];
  workouts: ParsedWorkout[];
  summary: {
    totalRecords: number;
    daysOfData: number;
    dateRange: { start: string; end: string };
  };
}

export interface ParsedSleepSession {
  date: string;
  bedtime: string;
  wakeTime: string;
  inBedMinutes: number;
  deepSleepMinutes: number;
  remSleepMinutes: number;
  lightSleepMinutes: number;
  awakeMinutes: number;
  totalSleepMinutes: number;
}

export interface ParsedDailyMetrics {
  date: string;
  steps: number | null;
  activeCalories: number | null;
  basalCalories: number | null;
  restingHeartRate: number | null;
  hrvAverage: number | null;
  avgHeartRate: number | null;
  spo2: number | null;
  vo2Max: number | null;
  respiratoryRate: number | null;
}

export interface ParsedWorkout {
  type: string;
  startTime: string;
  endTime: string;
  durationMinutes: number;
  calories: number | null;
  distance: number | null;
  avgHeartRate: number | null;
  maxHeartRate: number | null;
}

// ── Internal types ───────────────────────────────────────────────────────────

interface SleepFragment {
  start: Date;
  end: Date;
  startRaw: string;
  value: string;
}

interface DailyAccumulator {
  steps: number;
  activeCalories: number;
  basalCalories: number;
  restingHeartRate: number | null;
  hrvValues: number[];
  heartRateValues: number[];
  spo2Values: number[];
  vo2MaxEntries: { time: number; value: number }[];
  respiratoryRateValues: number[];
}

interface WorkoutAccumulator {
  type: string;
  startTime: string;
  endTime: string;
  durationMinutes: number;
  calories: number | null;
  distance: number | null;
  avgHeartRate: number | null;
  maxHeartRate: number | null;
}

// ── Helpers ──────────────────────────────────────────────────────────────────

/** Parse an Apple Health date string like "2026-03-28 08:00:00 -0700" */
function parseAHDate(s: string): Date | null {
  if (!s) return null;
  // "2026-03-28 08:00:00 -0700" → "2026-03-28T08:00:00-07:00"
  const normalized = s
    .replace(
      /^(\d{4}-\d{2}-\d{2}) (\d{2}:\d{2}:\d{2}) ([+-])(\d{2})(\d{2})$/,
      "$1T$2$3$4:$5"
    )
    .replace(/^(\d{4}-\d{2}-\d{2}) (\d{2}:\d{2}:\d{2})$/, "$1T$2");
  const d = new Date(normalized);
  return isNaN(d.getTime()) ? null : d;
}

/**
 * Determine the "sleep night" date from a raw Apple Health date string.
 * Uses the LOCAL hour from the raw string (before timezone conversion) so
 * that, e.g., "2026-03-28 01:30:00 -0700" resolves to 2026-03-27 (prev night).
 */
function sleepNightDate(raw: string): string {
  const datePart = raw.slice(0, 10); // "2026-03-28"
  const hourMatch = raw.match(/\d{4}-\d{2}-\d{2} (\d{2}):/);
  const localHour = hourMatch ? parseInt(hourMatch[1], 10) : 12;
  if (localHour < 12) {
    // Early-morning → belongs to previous night
    const base = new Date(datePart + "T12:00:00Z");
    return format(subDays(base, 1), "yyyy-MM-dd");
  }
  return datePart;
}

/** Get date string (yyyy-MM-dd) from raw Apple Health date string */
function dateFromRaw(raw: string): string {
  return raw.slice(0, 10);
}

function getOrCreateDay(
  map: Map<string, DailyAccumulator>,
  date: string
): DailyAccumulator {
  let acc = map.get(date);
  if (!acc) {
    acc = {
      steps: 0,
      activeCalories: 0,
      basalCalories: 0,
      restingHeartRate: null,
      hrvValues: [],
      heartRateValues: [],
      spo2Values: [],
      vo2MaxEntries: [],
      respiratoryRateValues: [],
    };
    map.set(date, acc);
  }
  return acc;
}

function mapWorkoutType(hkType: string): string {
  const mapping: Record<string, string> = {
    HKWorkoutActivityTypeRunning: "Running",
    HKWorkoutActivityTypeCycling: "Cycling",
    HKWorkoutActivityTypeWalking: "Walking",
    HKWorkoutActivityTypeSwimming: "Swimming",
    HKWorkoutActivityTypeHiking: "Hiking",
    HKWorkoutActivityTypeYoga: "Yoga",
    HKWorkoutActivityTypeFunctionalStrengthTraining: "Strength",
    HKWorkoutActivityTypeTraditionalStrengthTraining: "Strength",
    HKWorkoutActivityTypeHighIntensityIntervalTraining: "HIIT",
    HKWorkoutActivityTypeCrossTraining: "Cross Training",
    HKWorkoutActivityTypeElliptical: "Elliptical",
    HKWorkoutActivityTypeRowing: "Rowing",
    HKWorkoutActivityTypePilates: "Pilates",
    HKWorkoutActivityTypeDance: "Dance",
    HKWorkoutActivityTypeCoreTraining: "Core",
    HKWorkoutActivityTypeStairClimbing: "Stair Climbing",
  };
  return mapping[hkType] ?? hkType.replace("HKWorkoutActivityType", "");
}

// ── Sleep assembly ───────────────────────────────────────────────────────────

function assembleSleepSessions(
  fragments: SleepFragment[]
): ParsedSleepSession[] {
  if (fragments.length === 0) return [];

  const inBedFragments = fragments.filter(
    (f) => f.value === "HKCategoryValueSleepAnalysisInBed"
  );
  const stageFragments = fragments.filter(
    (f) => f.value !== "HKCategoryValueSleepAnalysisInBed"
  );

  // Group by night date
  const inBedByNight = new Map<string, SleepFragment[]>();
  for (const frag of inBedFragments) {
    const night = sleepNightDate(frag.startRaw);
    const arr = inBedByNight.get(night) ?? [];
    arr.push(frag);
    inBedByNight.set(night, arr);
  }

  const stagesByNight = new Map<string, SleepFragment[]>();
  for (const frag of stageFragments) {
    const night = sleepNightDate(frag.startRaw);
    const arr = stagesByNight.get(night) ?? [];
    arr.push(frag);
    stagesByNight.set(night, arr);
  }

  const allNights = new Set([
    ...inBedByNight.keys(),
    ...stagesByNight.keys(),
  ]);

  const sessions: ParsedSleepSession[] = [];

  for (const nightDate of allNights) {
    const inBeds = inBedByNight.get(nightDate) ?? [];
    const stages = stagesByNight.get(nightDate) ?? [];

    let bedtime: Date;
    let wakeTime: Date;

    if (inBeds.length > 0) {
      // If multiple InBed records, keep the longest (filters out naps)
      const sorted = [...inBeds].sort(
        (a, b) =>
          differenceInMinutes(b.end, b.start) -
          differenceInMinutes(a.end, a.start)
      );
      bedtime = sorted[0].start;
      wakeTime = sorted[0].end;
    } else if (stages.length > 0) {
      bedtime = stages.reduce((min, f) =>
        f.start < min ? f.start : min, stages[0].start
      );
      wakeTime = stages.reduce((max, f) =>
        f.end > max ? f.end : max, stages[0].end
      );
    } else {
      continue;
    }

    // Collect stage fragments that overlap the main sleep window
    const windowStages = stages.filter(
      (f) => f.start < wakeTime && f.end > bedtime
    );

    let deepMinutes = 0;
    let remMinutes = 0;
    let lightMinutes = 0;
    let awakeMinutes = 0;
    let legacyAsleepMinutes = 0;

    for (const stage of windowStages) {
      const clampedStart = stage.start < bedtime ? bedtime : stage.start;
      const clampedEnd = stage.end > wakeTime ? wakeTime : stage.end;
      const mins = differenceInMinutes(clampedEnd, clampedStart);
      if (mins <= 0) continue;

      switch (stage.value) {
        case "HKCategoryValueSleepAnalysisAsleepDeep":
          deepMinutes += mins;
          break;
        case "HKCategoryValueSleepAnalysisAsleepREM":
          remMinutes += mins;
          break;
        case "HKCategoryValueSleepAnalysisAsleepCore":
        case "HKCategoryValueSleepAnalysisAsleepUnspecified":
          lightMinutes += mins;
          break;
        case "HKCategoryValueSleepAnalysisAwake":
          awakeMinutes += mins;
          break;
        case "HKCategoryValueSleepAnalysisAsleep":
          legacyAsleepMinutes += mins;
          break;
      }
    }

    const inBedMinutes = differenceInMinutes(wakeTime, bedtime);
    const totalSleepMinutes =
      deepMinutes + remMinutes + lightMinutes > 0
        ? deepMinutes + remMinutes + lightMinutes
        : legacyAsleepMinutes > 0
        ? legacyAsleepMinutes
        : Math.max(0, inBedMinutes - awakeMinutes);

    sessions.push({
      date: nightDate,
      bedtime: bedtime.toISOString(),
      wakeTime: wakeTime.toISOString(),
      inBedMinutes,
      deepSleepMinutes: deepMinutes,
      remSleepMinutes: remMinutes,
      lightSleepMinutes: lightMinutes,
      awakeMinutes,
      totalSleepMinutes,
    });
  }

  return sessions;
}

// ── Daily metrics finalization ───────────────────────────────────────────────

function finalizeDailyMetrics(
  map: Map<string, DailyAccumulator>
): ParsedDailyMetrics[] {
  const results: ParsedDailyMetrics[] = [];
  for (const [date, acc] of map.entries()) {
    const hrvAverage =
      acc.hrvValues.length > 0
        ? acc.hrvValues.reduce((a, b) => a + b, 0) / acc.hrvValues.length
        : null;
    const avgHeartRate =
      acc.heartRateValues.length > 0
        ? acc.heartRateValues.reduce((a, b) => a + b, 0) /
          acc.heartRateValues.length
        : null;
    const spo2Raw =
      acc.spo2Values.length > 0
        ? acc.spo2Values.reduce((a, b) => a + b, 0) / acc.spo2Values.length
        : null;
    // Normalize spo2: Apple Health stores as 0-1 fraction on some devices
    const spo2 =
      spo2Raw != null ? (spo2Raw <= 1 ? spo2Raw * 100 : spo2Raw) : null;
    const respiratoryRate =
      acc.respiratoryRateValues.length > 0
        ? acc.respiratoryRateValues.reduce((a, b) => a + b, 0) /
          acc.respiratoryRateValues.length
        : null;
    // Latest vo2Max for the day
    let vo2Max: number | null = null;
    if (acc.vo2MaxEntries.length > 0) {
      const latest = acc.vo2MaxEntries.reduce((a, b) =>
        b.time > a.time ? b : a
      );
      vo2Max = latest.value;
    }

    results.push({
      date,
      steps: acc.steps > 0 ? acc.steps : null,
      activeCalories: acc.activeCalories > 0 ? acc.activeCalories : null,
      basalCalories: acc.basalCalories > 0 ? acc.basalCalories : null,
      restingHeartRate: acc.restingHeartRate,
      hrvAverage: hrvAverage != null ? Math.round(hrvAverage * 10) / 10 : null,
      avgHeartRate:
        avgHeartRate != null ? Math.round(avgHeartRate) : null,
      spo2: spo2 != null ? Math.round(spo2 * 10) / 10 : null,
      vo2Max: vo2Max != null ? Math.round(vo2Max * 10) / 10 : null,
      respiratoryRate:
        respiratoryRate != null ? Math.round(respiratoryRate * 10) / 10 : null,
    });
  }
  return results;
}

// ── Main parser ──────────────────────────────────────────────────────────────

export function parseAppleHealthXml(
  buffer: Buffer,
  maxDaysBack = 90
): AppleHealthParseResult {
  const cutoff = subDays(new Date(), maxDaysBack);

  const sleepFragments: SleepFragment[] = [];
  const dailyData = new Map<string, DailyAccumulator>();
  const workouts: ParsedWorkout[] = [];

  let currentWorkout: WorkoutAccumulator | null = null;
  let totalRecords = 0;

  const parser = sax.parser(true); // strict mode

  parser.onopentag = (node) => {
    const attrs = node.attributes as Record<string, string>;

    if (node.name === "Record") {
      totalRecords++;
      const type = attrs.type ?? "";
      const startRaw = attrs.startDate ?? "";
      const endRaw = attrs.endDate ?? "";
      const value = attrs.value ?? "";

      const startDate = parseAHDate(startRaw);
      if (!startDate || startDate < cutoff) return;

      // ── Sleep records ──────────────────────────────────────────────────────
      if (type === "HKCategoryTypeIdentifierSleepAnalysis") {
        const endDate = parseAHDate(endRaw);
        if (!endDate) return;
        sleepFragments.push({
          start: startDate,
          end: endDate,
          startRaw,
          value,
        });
        return;
      }

      // ── Quantity records ───────────────────────────────────────────────────
      const numVal = parseFloat(value);
      if (isNaN(numVal)) return;

      const date = dateFromRaw(startRaw);
      const acc = getOrCreateDay(dailyData, date);

      switch (type) {
        case "HKQuantityTypeIdentifierStepCount":
          acc.steps += numVal;
          break;
        case "HKQuantityTypeIdentifierActiveEnergyBurned":
          acc.activeCalories += numVal;
          break;
        case "HKQuantityTypeIdentifierBasalEnergyBurned":
          acc.basalCalories += numVal;
          break;
        case "HKQuantityTypeIdentifierRestingHeartRate":
          // Keep last value for the day (single daily measurement)
          acc.restingHeartRate = numVal;
          break;
        case "HKQuantityTypeIdentifierHeartRateVariabilitySDNN":
          acc.hrvValues.push(numVal);
          break;
        case "HKQuantityTypeIdentifierHeartRate":
          acc.heartRateValues.push(numVal);
          break;
        case "HKQuantityTypeIdentifierOxygenSaturation":
          acc.spo2Values.push(numVal);
          break;
        case "HKQuantityTypeIdentifierVO2Max":
          acc.vo2MaxEntries.push({ time: startDate.getTime(), value: numVal });
          break;
        case "HKQuantityTypeIdentifierRespiratoryRate":
          acc.respiratoryRateValues.push(numVal);
          break;
      }
    } else if (node.name === "Workout") {
      const startRaw = attrs.startDate ?? "";
      const endRaw = attrs.endDate ?? "";
      const startDate = parseAHDate(startRaw);
      if (!startDate || startDate < cutoff) return;

      const durationAttr = parseFloat(attrs.duration ?? "0");
      const durationUnit = (attrs.durationUnit ?? "min").toLowerCase();
      const durationMinutes =
        durationUnit === "s" || durationUnit === "sec"
          ? durationAttr / 60
          : durationAttr;

      const caloriesRaw = parseFloat(attrs.totalEnergyBurned ?? "");
      const distanceRaw = parseFloat(attrs.totalDistance ?? "");
      const distanceUnit = (attrs.totalDistanceUnit ?? "km").toLowerCase();

      let distanceMeters: number | null = null;
      if (!isNaN(distanceRaw)) {
        if (distanceUnit === "mi") distanceMeters = distanceRaw * 1609.344;
        else if (distanceUnit === "km") distanceMeters = distanceRaw * 1000;
        else distanceMeters = distanceRaw;
      }

      const endDate = parseAHDate(endRaw);
      currentWorkout = {
        type: mapWorkoutType(attrs.workoutActivityType ?? ""),
        startTime: startDate.toISOString(),
        endTime: endDate ? endDate.toISOString() : startDate.toISOString(),
        durationMinutes: Math.round(durationMinutes),
        calories: isNaN(caloriesRaw) ? null : Math.round(caloriesRaw),
        distance: distanceMeters != null ? Math.round(distanceMeters) : null,
        avgHeartRate: null,
        maxHeartRate: null,
      };
    } else if (
      node.name === "WorkoutStatistics" &&
      currentWorkout !== null
    ) {
      const type = attrs.type ?? "";
      if (type === "HKQuantityTypeIdentifierHeartRate") {
        const avg = parseFloat(attrs.average ?? "");
        const max = parseFloat(attrs.maximum ?? "");
        if (!isNaN(avg)) currentWorkout.avgHeartRate = Math.round(avg);
        if (!isNaN(max)) currentWorkout.maxHeartRate = Math.round(max);
      }
    }
  };

  parser.onclosetag = (name) => {
    if (name === "Workout" && currentWorkout !== null) {
      workouts.push({ ...currentWorkout });
      currentWorkout = null;
    }
  };

  // Skip non-fatal XML errors (Apple exports sometimes have encoding issues)
  parser.onerror = () => {
    parser.resume();
  };

  parser.write(buffer.toString("utf8")).close();

  const sleepSessions = assembleSleepSessions(sleepFragments);
  const dailyMetrics = finalizeDailyMetrics(dailyData);

  // Summary
  const allDates = [
    ...sleepSessions.map((s) => s.date),
    ...dailyMetrics.map((d) => d.date),
    ...workouts.map((w) => w.startTime.slice(0, 10)),
  ].sort();

  return {
    sleepSessions,
    dailyMetrics,
    workouts,
    summary: {
      totalRecords,
      daysOfData: new Set(allDates).size,
      dateRange: {
        start: allDates[0] ?? "",
        end: allDates[allDates.length - 1] ?? "",
      },
    },
  };
}
