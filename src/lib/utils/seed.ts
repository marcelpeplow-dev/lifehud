import {
  subDays,
  format,
  addMinutes,
  setHours,
  setMinutes,
  startOfDay,
} from "date-fns";
import type { Database } from "@/types/index";
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnySupabaseClient = import("@supabase/supabase-js").SupabaseClient<any>;

// Use loose insert types — raw_data and nullable fields are optional in practice
type SleepInsert = Partial<Database["public"]["Tables"]["sleep_records"]["Insert"]> & {
  user_id: string;
  date: string;
};
type WorkoutInsert = Partial<Database["public"]["Tables"]["workouts"]["Insert"]> & {
  user_id: string;
  date: string;
};
type MetricsInsert = Partial<Database["public"]["Tables"]["daily_metrics"]["Insert"]> & {
  user_id: string;
  date: string;
};
type InsightInsert = Partial<Database["public"]["Tables"]["insights"]["Insert"]> & {
  user_id: string;
  date: string;
  category: Database["public"]["Tables"]["insights"]["Insert"]["category"];
  title: string;
  body: string;
};
type CheckInInsert = {
  user_id: string;
  date: string;
  mood: number;
  energy: number;
  stress: number;
  notes?: string | null;
};
type ManualEntry = {
  user_id: string;
  date: string;
  metric_id: string;
  value: number;
};
type ManualConfigRow = {
  user_id: string;
  domain: string;
  metric_id: string;
  enabled: boolean;
  display_order: number;
};

// Simple seeded random to make data look natural but still vary each run
function rand(min: number, max: number) {
  return min + Math.random() * (max - min);
}

function randInt(min: number, max: number) {
  return Math.round(rand(min, max));
}

// ─── CORRELATION DATA ─────────────────────────────────────────────────────────

interface DayCorrelation {
  caffeineLastDoseHour: number; // decimal hour; 0 = no caffeine
  alcoholDrinks: number;
  screenTimeBeforeBed: number; // hours
  hydrationLiters: number;
}

type CorrelationMap = Map<string, DayCorrelation>;

// ─── SLEEP ───────────────────────────────────────────────────────────────────

function generateSleepRecords(userId: string, correlations?: CorrelationMap): SleepInsert[] {
  const records: SleepInsert[] = [];
  const today = new Date();

  for (let daysAgo = 30; daysAgo >= 1; daysAgo--) {
    const date = subDays(today, daysAgo);
    const dateStr = format(date, "yyyy-MM-dd");
    const isWeekend = date.getDay() === 0 || date.getDay() === 6;
    const isBadNight = Math.random() < 0.12; // ~1 bad night/week

    let durationMinutes: number;
    if (isBadNight) {
      durationMinutes = randInt(270, 330); // 4.5–5.5 h
    } else if (isWeekend) {
      durationMinutes = randInt(450, 510); // 7.5–8.5 h
    } else {
      durationMinutes = randInt(390, 465); // 6.5–7.75 h
    }

    // Sleep stage breakdown (realistic ratios)
    const deepPct = rand(0.16, 0.22);
    const remPct = rand(0.17, 0.23);
    const awakePct = rand(0.02, 0.05);
    let deepSleepMinutes = Math.round(durationMinutes * deepPct);
    let remSleepMinutes = Math.round(durationMinutes * remPct);
    let awakeMinutes = Math.round(durationMinutes * awakePct);
    let lightSleepMinutes = durationMinutes - deepSleepMinutes - remSleepMinutes - awakeMinutes;

    const bedtimeBase = isWeekend ? rand(22.5, 24) : rand(22, 23.5);
    const bedtimeHour = Math.floor(bedtimeBase);
    const bedtimeMin = Math.round((bedtimeBase - bedtimeHour) * 60);
    const bedtime = setMinutes(setHours(startOfDay(date), bedtimeHour % 24), bedtimeMin);
    const wakeTime = addMinutes(bedtime, durationMinutes);

    const durationFactor = Math.min(durationMinutes / 480, 1);
    let sleepScore = Math.round(55 + durationFactor * 35 + rand(-5, 5));
    let avgHrv = Math.round(rand(35, 58));

    // ── Apply cross-domain correlations (noisy, not deterministic) ────────────
    if (correlations) {
      const corr = correlations.get(dateStr);
      if (corr) {
        // Caffeine: late last dose (>15h = 3pm) → worse sleep efficiency, more wake time
        if (corr.caffeineLastDoseHour > 15 && Math.random() < 0.75) {
          const lateFactor = Math.min((corr.caffeineLastDoseHour - 15) / 3, 1);
          durationMinutes = Math.max(240, durationMinutes - Math.round(rand(5, 15) * lateFactor));
          awakeMinutes = Math.min(Math.round(durationMinutes * 0.12), awakeMinutes + Math.round(rand(5, 12) * lateFactor));
          sleepScore = Math.max(30, sleepScore - Math.round(rand(2, 7)));
        }

        // Alcohol → reduced REM, higher wake time, lower HRV
        if (corr.alcoholDrinks > 0 && Math.random() < 0.80) {
          const alcoholFactor = Math.min(corr.alcoholDrinks / 4, 1);
          remSleepMinutes = Math.max(0, remSleepMinutes - Math.round(durationMinutes * rand(0.03, 0.06) * alcoholFactor));
          awakeMinutes = Math.min(Math.round(durationMinutes * 0.15), awakeMinutes + Math.round(rand(5, 12) * alcoholFactor));
          sleepScore = Math.max(30, sleepScore - Math.round(rand(3, 9)));
          avgHrv = Math.max(20, Math.round(avgHrv * (1 - rand(0.05, 0.15) * alcoholFactor)));
        }

        // Screen time before bed > 1h → harder to fall asleep → less total sleep
        if (corr.screenTimeBeforeBed > 1.0 && Math.random() < 0.70) {
          const screenFactor = Math.min((corr.screenTimeBeforeBed - 1) / 1, 1);
          durationMinutes = Math.max(240, durationMinutes - Math.round(rand(5, 10) * screenFactor));
          awakeMinutes = Math.min(Math.round(durationMinutes * 0.12), awakeMinutes + Math.round(rand(3, 8) * screenFactor));
          sleepScore = Math.max(30, sleepScore - Math.round(rand(1, 4)));
        }

        // Recalculate light sleep to keep totals consistent
        lightSleepMinutes = Math.max(0, durationMinutes - deepSleepMinutes - remSleepMinutes - awakeMinutes);
      }
    }

    records.push({
      user_id: userId,
      date: dateStr,
      bedtime: bedtime.toISOString(),
      wake_time: wakeTime.toISOString(),
      duration_minutes: durationMinutes,
      deep_sleep_minutes: deepSleepMinutes,
      rem_sleep_minutes: remSleepMinutes,
      light_sleep_minutes: lightSleepMinutes,
      awake_minutes: awakeMinutes,
      sleep_score: Math.min(sleepScore, 100),
      avg_heart_rate: Math.round(rand(54, 63)),
      avg_hrv: avgHrv,
      source: "seed",
    });
  }

  return records;
}

// ─── WORKOUTS ─────────────────────────────────────────────────────────────────

const WORKOUT_TEMPLATES = [
  { workout_type: "cardio" as const,    activity_name: "Running",        baseDuration: 38, baseCalories: 310, baseDistance: 5200,  avgHR: 158 },
  { workout_type: "strength" as const,  activity_name: "Weight Training", baseDuration: 58, baseCalories: 260, baseDistance: null,  avgHR: 135 },
  { workout_type: "cardio" as const,    activity_name: "Cycling",         baseDuration: 52, baseCalories: 380, baseDistance: 18000, avgHR: 148 },
  { workout_type: "strength" as const,  activity_name: "Weight Training", baseDuration: 55, baseCalories: 240, baseDistance: null,  avgHR: 132 },
];

const WORKOUT_DAY_PATTERNS = [
  [1, 3, 5], [1, 3, 5, 6], [2, 4, 6], [1, 3, 5, 0], [1, 2, 4, 6],
];

function generateWorkouts(userId: string): WorkoutInsert[] {
  const workouts: WorkoutInsert[] = [];
  const today = new Date();
  const pattern = WORKOUT_DAY_PATTERNS[Math.floor(Math.random() * WORKOUT_DAY_PATTERNS.length)];

  for (let daysAgo = 30; daysAgo >= 1; daysAgo--) {
    const date = subDays(today, daysAgo);
    const dayOfWeek = date.getDay();
    if (!pattern.includes(dayOfWeek)) continue;
    if (Math.random() < 0.15) continue;

    const improvementFactor = 1 + ((30 - daysAgo) / 30) * 0.08;
    const template = WORKOUT_TEMPLATES[Math.floor(Math.random() * WORKOUT_TEMPLATES.length)];
    const durationVariance = rand(0.85, 1.15);
    const durationMinutes = Math.round(template.baseDuration * durationVariance * improvementFactor);
    const startHour = randInt(6, 19);
    const startedAt = setHours(startOfDay(date), startHour);
    const endedAt = addMinutes(startedAt, durationMinutes);
    const calories = Math.round(template.baseCalories * durationVariance * improvementFactor + rand(-20, 20));
    const avgHR = Math.round(template.avgHR + rand(-8, 8));
    const maxHR = Math.round(avgHR + rand(15, 30));
    const distance = template.baseDistance ? Math.round(template.baseDistance * durationVariance * improvementFactor) : null;
    const intensityScore = Math.round(Math.min(((avgHR - 100) / 80) * 100 + rand(-5, 5), 100));

    workouts.push({
      user_id: userId,
      date: format(date, "yyyy-MM-dd"),
      started_at: startedAt.toISOString(),
      ended_at: endedAt.toISOString(),
      duration_minutes: durationMinutes,
      workout_type: template.workout_type,
      activity_name: template.activity_name,
      calories_burned: calories,
      avg_heart_rate: avgHR,
      max_heart_rate: maxHR,
      distance_meters: distance,
      intensity_score: Math.max(intensityScore, 10),
      source: "seed",
    });
  }

  return workouts;
}

// ─── DAILY METRICS ────────────────────────────────────────────────────────────

function generateDailyMetrics(userId: string, workoutDates: Set<string>): MetricsInsert[] {
  const metrics: MetricsInsert[] = [];
  const today = new Date();

  for (let daysAgo = 30; daysAgo >= 1; daysAgo--) {
    const date = subDays(today, daysAgo);
    const dateStr = format(date, "yyyy-MM-dd");
    const isWorkoutDay = workoutDates.has(dateStr);
    const isWeekend = date.getDay() === 0 || date.getDay() === 6;

    const baseSteps = isWorkoutDay ? randInt(8000, 12000) : randInt(5000, 9000);
    const weekendBonus = isWeekend ? randInt(0, 1500) : 0;
    const steps = baseSteps + weekendBonus;
    const activeMinutes = isWorkoutDay ? randInt(40, 90) : randInt(15, 45);
    const trendReduction = ((30 - daysAgo) / 30) * 3;
    const restingHR = Math.round(rand(61, 66) - trendReduction + rand(-1.5, 1.5));
    const hrv = Math.round(rand(35, 58));
    const caloriesTotal = Math.round(rand(1800, 2400));
    const caloriesActive = isWorkoutDay ? Math.round(rand(300, 550)) : Math.round(rand(100, 280));

    metrics.push({
      user_id: userId,
      date: dateStr,
      steps,
      active_minutes: activeMinutes,
      resting_heart_rate: Math.max(restingHR, 52),
      hrv_average: hrv,
      calories_total: caloriesTotal,
      calories_active: caloriesActive,
      stress_score: null,
      recovery_score: null,
      source: "seed",
    });
  }

  return metrics;
}

// ─── MANUAL ENTRIES ───────────────────────────────────────────────────────────

const MANUAL_DOMAIN_METRICS: Record<string, string[]> = {
  wellbeing:   ["wellbeing_mood", "wellbeing_energy", "wellbeing_stress", "wellbeing_focus"],
  caffeine:    ["caffeine_total_daily", "caffeine_doses", "caffeine_last_dose", "caffeine_first_dose"],
  hydration:   ["hydration_water_intake"],
  supplements: ["supplements_taken", "supplements_dose"],
  screen_time: ["screen_time_total", "screen_time_before_bed"],
  substances:  ["substances_alcohol", "substances_cannabis"],
};

function generateManualData(
  userId: string,
  workoutDates: Set<string>,
  sleepByDate: Map<string, number>,
): { entries: ManualEntry[]; configs: ManualConfigRow[]; correlations: CorrelationMap } {
  const today = new Date();
  const entries: ManualEntry[] = [];
  const correlations: CorrelationMap = new Map();

  function push(date: string, metricId: string, value: number) {
    entries.push({ user_id: userId, date, metric_id: metricId, value });
  }

  for (let daysAgo = 30; daysAgo >= 1; daysAgo--) {
    const date = subDays(today, daysAgo);
    const dateStr = format(date, "yyyy-MM-dd");
    const dow = date.getDay();
    const isWeekend = dow === 0 || dow === 6;
    const isWorkoutDay = workoutDates.has(dateStr);
    const isFriSat = dow === 5 || dow === 6;

    // ── Caffeine ──────────────────────────────────────────────────────────────
    const caffeineTotal = isWeekend ? randInt(100, 200) : randInt(200, 350);
    const caffeineDoses = Math.max(1, Math.round(caffeineTotal / 100) + randInt(-1, 1));
    const caffeineFirstDose = rand(7.0, 9.0);
    const isLateDose = Math.random() < 0.25; // 25% chance of a late dose (>3pm)
    const caffeineLastDose = isLateDose ? rand(15.5, 18.0) : rand(13.0, 15.0);

    push(dateStr, "caffeine_total_daily", caffeineTotal);
    push(dateStr, "caffeine_doses", caffeineDoses);
    push(dateStr, "caffeine_last_dose", caffeineLastDose);
    push(dateStr, "caffeine_first_dose", caffeineFirstDose);

    // ── Hydration ─────────────────────────────────────────────────────────────
    // Upward trend over 30 days; workout day bump
    const hydrationBase = 2.0 + ((30 - daysAgo) / 30) * 0.5;
    const hydrationRaw = hydrationBase + (isWorkoutDay ? rand(0.3, 0.6) : 0) + rand(-0.3, 0.5);
    const hydrationLiters = Math.round(Math.min(Math.max(hydrationRaw, 1.5), 4.0) * 10) / 10;
    push(dateStr, "hydration_water_intake", hydrationLiters);

    // ── Supplements ───────────────────────────────────────────────────────────
    const supplementsTaken = Math.random() < 0.8 ? 1 : 0;
    push(dateStr, "supplements_taken", supplementsTaken);
    if (supplementsTaken) push(dateStr, "supplements_dose", randInt(1, 3));

    // ── Screen time ───────────────────────────────────────────────────────────
    const screenTotal = Math.round((isWeekend ? rand(4, 7) : rand(6, 10)) * 10) / 10;
    const screenBeforeBed = Math.round(Math.min(rand(0, 2.5), screenTotal * 0.3) * 10) / 10;
    push(dateStr, "screen_time_total", screenTotal);
    push(dateStr, "screen_time_before_bed", screenBeforeBed);

    // ── Substances ────────────────────────────────────────────────────────────
    const alcoholDrinks = isFriSat && Math.random() < 0.60
      ? randInt(1, 4)
      : !isWeekend && Math.random() < 0.10
      ? randInt(1, 2)
      : 0;
    const cannabisUses = Math.random() < 0.20 ? 1 : 0;
    if (alcoholDrinks > 0) push(dateStr, "substances_alcohol", alcoholDrinks);
    if (cannabisUses > 0)  push(dateStr, "substances_cannabis", cannabisUses);

    // ── Wellbeing focus ───────────────────────────────────────────────────────
    // Correlate with sleep quality and hydration
    const sleepMins = sleepByDate.get(dateStr) ?? 420;
    const focusBase = rand(4, 9);
    const focusSleepBonus = sleepMins >= 420 ? rand(0.3, 1.0) : sleepMins < 360 ? rand(-1.5, -0.5) : 0;
    const focusHydBonus = hydrationLiters > 2.5 ? rand(0.2, 0.7) : 0;
    const focus = Math.min(10, Math.max(1, Math.round((focusBase + focusSleepBonus + focusHydBonus) * 10) / 10));
    push(dateStr, "wellbeing_focus", focus);

    correlations.set(dateStr, {
      caffeineLastDoseHour: caffeineLastDose,
      alcoholDrinks,
      screenTimeBeforeBed: screenBeforeBed,
      hydrationLiters,
    });
  }

  // Build enabled config for every manual domain metric
  const configs: ManualConfigRow[] = [];
  for (const [domain, metricIds] of Object.entries(MANUAL_DOMAIN_METRICS)) {
    metricIds.forEach((metricId, idx) => {
      configs.push({ user_id: userId, domain, metric_id: metricId, enabled: true, display_order: idx });
    });
  }

  return { entries, configs, correlations };
}

// ─── CHECK-INS ────────────────────────────────────────────────────────────────

const SAMPLE_NOTES = [
  "Feeling good after yesterday's workout.",
  "Busy day at work, a bit mentally drained.",
  "Slept really well last night, ready to go.",
  "Skipped workout today, needed rest.",
  "Productive morning, energy held up well.",
  "Stressful meeting but managed okay.",
  "Legs still sore from yesterday.",
  "Great mood, got outside for a walk.",
  "Tired but pushed through the afternoon.",
  "Feeling balanced today.",
];

function generateCheckIns(
  userId: string,
  sleepByDate: Map<string, number>,
  workoutDates: Set<string>,
  correlations?: CorrelationMap,
): CheckInInsert[] {
  const checkins: CheckInInsert[] = [];
  const today = new Date();

  for (let daysAgo = 30; daysAgo >= 0; daysAgo--) {
    const date = subDays(today, daysAgo);
    const dateStr = format(date, "yyyy-MM-dd");

    const sleepMins = sleepByDate.get(dateStr) ?? 420;
    const isWorkoutDay = workoutDates.has(dateStr);
    const isWeekend = date.getDay() === 0 || date.getDay() === 6;
    const corr = correlations?.get(dateStr);

    const sleepBonus = sleepMins >= 420 ? randInt(1, 2) : sleepMins < 360 ? -randInt(1, 2) : 0;
    const baseMood = randInt(5, 8);
    const mood = Math.min(10, Math.max(1, baseMood + sleepBonus));

    const baseEnergy = randInt(4, 8);
    const energyBonus = sleepMins >= 420 ? 1 : sleepMins < 360 ? -1 : 0;
    const workoutPenalty = isWorkoutDay && Math.random() < 0.3 ? -1 : 0;
    // Hydration correlation: well-hydrated days get an energy boost
    const hydrationBonus = corr && corr.hydrationLiters > 2.5 && Math.random() < 0.75
      ? Math.round(rand(0.5, 1.5))
      : 0;
    const energy = Math.min(10, Math.max(1, baseEnergy + energyBonus + workoutPenalty + hydrationBonus));

    const baseStress = isWeekend ? randInt(2, 5) : randInt(3, 7);
    const stressFromSleep = sleepMins < 360 ? 1 : 0;
    const stress = Math.min(10, Math.max(1, baseStress + stressFromSleep));

    const notes = Math.random() < 0.3
      ? SAMPLE_NOTES[Math.floor(Math.random() * SAMPLE_NOTES.length)]
      : null;

    checkins.push({ user_id: userId, date: dateStr, mood, energy, stress, notes });
  }

  return checkins;
}

// ─── SAMPLE INSIGHTS ─────────────────────────────────────────────────────────

function generateInsights(userId: string): InsightInsert[] {
  const today = new Date();
  return [
    {
      user_id: userId,
      date: format(subDays(today, 1), "yyyy-MM-dd"),
      category: "correlation",
      title: "Sleep is your secret weapon",
      body: "This week, your workouts after 7+ hours of sleep burned 34% more calories than after short nights. You slept 7.4 hours last night — today's a great day to push it.",
      priority: 5,
      is_read: false,
      is_dismissed: false,
    },
    {
      user_id: userId,
      date: format(subDays(today, 1), "yyyy-MM-dd"),
      category: "fitness",
      title: "Consistency is building momentum",
      body: "You've completed 12 workouts over the past 30 days, averaging 3 per week. Your active minutes are up 18% vs the previous month — the habit is sticking.",
      priority: 4,
      is_read: false,
      is_dismissed: false,
    },
    {
      user_id: userId,
      date: format(subDays(today, 2), "yyyy-MM-dd"),
      category: "sleep",
      title: "Bedtime is drifting later",
      body: "Your average bedtime has shifted from 10:45pm to 11:20pm over the past two weeks. Nights you go to bed after 11pm show 12% less deep sleep on average.",
      priority: 4,
      is_read: true,
      is_dismissed: false,
    },
    {
      user_id: userId,
      date: format(subDays(today, 3), "yyyy-MM-dd"),
      category: "recovery",
      title: "Resting heart rate is trending down",
      body: "Your resting HR has dropped from 65 bpm to 62 bpm over the past 30 days — a clear sign your cardiovascular fitness is improving. Keep the aerobic work consistent.",
      priority: 3,
      is_read: true,
      is_dismissed: false,
    },
    {
      user_id: userId,
      date: format(subDays(today, 5), "yyyy-MM-dd"),
      category: "sleep",
      title: "Weekend recovery is working",
      body: "You're averaging 8.1 hours of sleep on weekends vs 6.8 on weekdays. That extra recovery is likely why your Monday workouts are consistently your strongest of the week.",
      priority: 3,
      is_read: true,
      is_dismissed: false,
    },
    {
      user_id: userId,
      date: format(subDays(today, 7), "yyyy-MM-dd"),
      category: "general",
      title: "30-day check-in looks solid",
      body: "Over the past month: 12 workouts completed, average sleep of 7.1 hours, and resting HR down 3 bpm. You're building a real base — the next 30 days will compound on this.",
      priority: 2,
      is_read: true,
      is_dismissed: false,
    },
  ];
}

// ─── SEED GOALS ──────────────────────────────────────────────────────────────

function generateGoals(userId: string) {
  return [
    {
      user_id: userId,
      title: "Sleep 7+ hours per night",
      category: "sleep",
      metric_name: "sleep_duration",
      target_value: 420,
      target_unit: "minutes",
      target_frequency: "daily",
      current_value: 0,
      is_active: true,
    },
    {
      user_id: userId,
      title: "Work out 4x per week",
      category: "fitness",
      metric_name: "weekly_workouts",
      target_value: 4,
      target_unit: "workouts",
      target_frequency: "weekly",
      current_value: 0,
      is_active: true,
    },
    {
      user_id: userId,
      title: "Walk 10,000 steps daily",
      category: "fitness",
      metric_name: "steps",
      target_value: 10000,
      target_unit: "steps",
      target_frequency: "daily",
      current_value: 0,
      is_active: true,
    },
  ];
}

// ─── CHESS GAMES ─────────────────────────────────────────────────────────────

const OPENINGS = [
  "Italian Game", "Sicilian Defense", "French Defense", "Ruy Lopez",
  "Queens Gambit", "Kings Indian", "English Opening", "Caro Kann",
  "Scandinavian Defense", "Pirc Defense", "Dutch Defense", "London System",
];

const RESULT_DETAILS_WIN  = ["checkmate", "resignation", "timeout"];
const RESULT_DETAILS_LOSS = ["checkmated", "resignation", "timeout"];
const RESULT_DETAILS_DRAW = ["stalemate", "draw by agreement", "draw by repetition"];

type ChessGameInsert = {
  user_id: string; game_id: string; played_at: string; date: string;
  time_class: string; time_control: string; player_color: string;
  player_rating: number; opponent_rating: number; result: string;
  result_detail: string; accuracy: number | null; num_moves: number;
  duration_seconds: number; opening_name: string; raw_pgn: string | null;
};

function generateChessGames(
  userId: string,
  sleepByDate: Map<string, number>,
  workoutDates: Set<string>,
): ChessGameInsert[] {
  const games: ChessGameInsert[] = [];
  const today = new Date();

  const ratings: Record<string, number> = {
    rapid: 1100 + randInt(-10, 10),
    blitz: 1080 + randInt(-10, 10),
    bullet: 1050 + randInt(-10, 10),
  };

  const totalGames = randInt(60, 90);
  const gamesPerDay: number[] = new Array(30).fill(0);
  for (let i = 0; i < totalGames; i++) {
    gamesPerDay[Math.floor(Math.random() * 30)]++;
  }

  let gameCounter = 0;

  for (let daysAgo = 30; daysAgo >= 1; daysAgo--) {
    const date = subDays(today, daysAgo);
    const dateStr = format(date, "yyyy-MM-dd");
    const numGames = gamesPerDay[30 - daysAgo];
    if (numGames === 0) continue;

    const sleepMins = sleepByDate.get(dateStr) ?? 420;
    const goodSleep = sleepMins >= 420;
    const isWorkoutDay = workoutDates.has(dateStr);
    const performanceBoost = (goodSleep ? 0.06 : -0.04) + (isWorkoutDay ? 0.04 : 0);

    for (let g = 0; g < numGames; g++) {
      gameCounter++;
      const tcRoll = Math.random();
      const timeClass = tcRoll < 0.4 ? "rapid" : tcRoll < 0.8 ? "blitz" : "bullet";
      const timeControl = timeClass === "rapid" ? "600" : timeClass === "blitz" ? "180+2" : "60";

      const hour = randInt(7, 23);
      const playedAt = new Date(date);
      playedAt.setHours(hour, randInt(0, 59), randInt(0, 59));

      const todBoost = hour >= 6 && hour < 14 ? 0.04 : hour >= 22 ? -0.06 : 0;
      const winProb = 0.52 + performanceBoost + todBoost;
      const roll = Math.random();
      const result: "win" | "loss" | "draw" = roll < winProb ? "win" : roll < winProb + 0.44 ? "loss" : "draw";

      const ratingDelta = result === "win" ? randInt(5, 15) : result === "loss" ? -randInt(4, 12) : randInt(-2, 2);
      ratings[timeClass] = Math.max(800, ratings[timeClass] + ratingDelta + (result === "win" ? 1 : 0));

      const playerRating = ratings[timeClass];
      const hasAccuracy = Math.random() < 0.6;
      const accuracy = hasAccuracy
        ? Math.min(Math.round((rand(55, 85) + (goodSleep ? rand(2, 5) : 0)) * 10) / 10, 98)
        : null;

      const resultDetail = result === "win"
        ? RESULT_DETAILS_WIN[Math.floor(Math.random() * RESULT_DETAILS_WIN.length)]
        : result === "loss"
        ? RESULT_DETAILS_LOSS[Math.floor(Math.random() * RESULT_DETAILS_LOSS.length)]
        : RESULT_DETAILS_DRAW[Math.floor(Math.random() * RESULT_DETAILS_DRAW.length)];

      const baseDuration = timeClass === "rapid" ? 600 : timeClass === "blitz" ? 180 : 60;

      games.push({
        user_id: userId,
        game_id: `https://www.chess.com/game/live/seed-${gameCounter}`,
        played_at: playedAt.toISOString(),
        date: dateStr,
        time_class: timeClass,
        time_control: timeControl,
        player_color: Math.random() < 0.5 ? "white" : "black",
        player_rating: playerRating,
        opponent_rating: playerRating + randInt(-150, 150),
        result,
        result_detail: resultDetail,
        accuracy,
        num_moves: randInt(20, 60),
        duration_seconds: Math.round(baseDuration * rand(0.5, 1.8)),
        opening_name: OPENINGS[Math.floor(Math.random() * OPENINGS.length)],
        raw_pgn: null,
      });
    }
  }

  return games;
}

// ─── MAIN SEED FUNCTION ───────────────────────────────────────────────────────

export async function seedUserData(
  supabase: AnySupabaseClient,
  userId: string
): Promise<{
  sleep: number; workouts: number; metrics: number; insights: number;
  goals: number; checkins: number; chess: number; manualEntries: number;
}> {
  // Clear existing seed data
  await Promise.all([
    supabase.from("sleep_records").delete().eq("user_id", userId).eq("source", "seed"),
    supabase.from("workouts").delete().eq("user_id", userId).eq("source", "seed"),
    supabase.from("daily_metrics").delete().eq("user_id", userId).eq("source", "seed"),
    supabase.from("goals").delete().eq("user_id", userId),
    supabase
      .from("insights")
      .delete()
      .eq("user_id", userId)
      .in("category", ["sleep", "fitness", "recovery", "correlation", "general", "wellbeing", "chess"]),
    supabase.from("daily_checkins").delete().eq("user_id", userId),
    supabase.from("chess_games").delete().eq("user_id", userId),
    supabase.from("manual_entries").delete().eq("user_id", userId),
    supabase.from("user_manual_config").delete().eq("user_id", userId),
  ]);

  // Step 1: Generate workouts so we have workout dates for correlations
  const workoutRecords = generateWorkouts(userId);
  const workoutDateSet = new Set(workoutRecords.map((w) => w.date as string));

  // Step 2: Generate base sleep records (no correlations yet)
  const baseSleepByDate = new Map<string, number>();
  const today = new Date();
  for (let d = 30; d >= 1; d--) {
    const dt = subDays(today, d);
    const isWeekend = dt.getDay() === 0 || dt.getDay() === 6;
    baseSleepByDate.set(format(dt, "yyyy-MM-dd"), isWeekend ? 470 : 420);
  }

  // Step 3: Generate manual data with correlations (uses base sleep for focus)
  const { entries: manualEntries, configs: manualConfigs, correlations } =
    generateManualData(userId, workoutDateSet, baseSleepByDate);

  // Step 4: Generate sleep records WITH correlations applied
  const sleepRecords = generateSleepRecords(userId, correlations);
  const sleepByDate = new Map(sleepRecords.map((s) => [s.date as string, s.duration_minutes as number]));

  // Step 5: Generate remaining data
  const metricRecords  = generateDailyMetrics(userId, workoutDateSet);
  const insightRecords = generateInsights(userId);
  const goalRecords    = generateGoals(userId);
  const checkInRecords = generateCheckIns(userId, sleepByDate, workoutDateSet, correlations);
  const chessRecords   = generateChessGames(userId, sleepByDate, workoutDateSet);

  const [sleepRes, workoutRes, metricsRes, insightsRes, goalsRes, checkInsRes, chessRes, manualEntriesRes, manualConfigRes] =
    await Promise.all([
      supabase.from("sleep_records").insert(sleepRecords),
      supabase.from("workouts").insert(workoutRecords),
      supabase.from("daily_metrics").insert(metricRecords),
      supabase.from("insights").insert(insightRecords),
      supabase.from("goals").insert(goalRecords),
      supabase.from("daily_checkins").insert(checkInRecords),
      supabase.from("chess_games").insert(chessRecords),
      supabase.from("manual_entries").insert(manualEntries),
      supabase.from("user_manual_config").upsert(manualConfigs, { onConflict: "user_id,metric_id" }),
    ]);

  if (sleepRes.error)         throw new Error(`Sleep: ${sleepRes.error.message}`);
  if (workoutRes.error)       throw new Error(`Workouts: ${workoutRes.error.message}`);
  if (metricsRes.error)       throw new Error(`Metrics: ${metricsRes.error.message}`);
  if (insightsRes.error)      throw new Error(`Insights: ${insightsRes.error.message}`);
  if (goalsRes.error)         throw new Error(`Goals: ${goalsRes.error.message}`);
  if (checkInsRes.error)      throw new Error(`Check-ins: ${checkInsRes.error.message}`);
  if (chessRes.error)         throw new Error(`Chess: ${chessRes.error.message}`);
  if (manualEntriesRes.error) throw new Error(`Manual entries: ${manualEntriesRes.error.message}`);
  if (manualConfigRes.error)  throw new Error(`Manual config: ${manualConfigRes.error.message}`);

  await supabase
    .from("profiles")
    .update({ chess_username: "lifehud_demo", last_chess_sync: new Date().toISOString() })
    .eq("id", userId);

  return {
    sleep: sleepRecords.length,
    workouts: workoutRecords.length,
    metrics: metricRecords.length,
    insights: insightRecords.length,
    goals: goalRecords.length,
    checkins: checkInRecords.length,
    chess: chessRecords.length,
    manualEntries: manualEntries.length,
  };
}
