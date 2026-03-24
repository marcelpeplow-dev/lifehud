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

// Simple seeded random to make data look natural but still vary each run
function rand(min: number, max: number) {
  return min + Math.random() * (max - min);
}

function randInt(min: number, max: number) {
  return Math.round(rand(min, max));
}

// ─── SLEEP ───────────────────────────────────────────────────────────────────

function generateSleepRecords(userId: string): SleepInsert[] {
  const records: SleepInsert[] = [];
  const today = new Date();

  for (let daysAgo = 30; daysAgo >= 1; daysAgo--) {
    const date = subDays(today, daysAgo);
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
    const deepSleepMinutes = Math.round(durationMinutes * deepPct);
    const remSleepMinutes = Math.round(durationMinutes * remPct);
    const awakeMinutes = Math.round(durationMinutes * awakePct);
    const lightSleepMinutes =
      durationMinutes - deepSleepMinutes - remSleepMinutes - awakeMinutes;

    // Bedtime: 10:00pm–11:45pm (earlier on school nights)
    const bedtimeBase = isWeekend ? rand(22.5, 24) : rand(22, 23.5);
    const bedtimeHour = Math.floor(bedtimeBase);
    const bedtimeMin = Math.round((bedtimeBase - bedtimeHour) * 60);
    const bedtime = setMinutes(
      setHours(startOfDay(date), bedtimeHour % 24),
      bedtimeMin
    );
    const wakeTime = addMinutes(bedtime, durationMinutes);

    // Sleep score correlates loosely with duration
    const durationFactor = Math.min(durationMinutes / 480, 1); // 8 h = perfect
    const sleepScore = Math.round(55 + durationFactor * 35 + rand(-5, 5));

    records.push({
      user_id: userId,
      date: format(date, "yyyy-MM-dd"),
      bedtime: bedtime.toISOString(),
      wake_time: wakeTime.toISOString(),
      duration_minutes: durationMinutes,
      deep_sleep_minutes: deepSleepMinutes,
      rem_sleep_minutes: remSleepMinutes,
      light_sleep_minutes: lightSleepMinutes,
      awake_minutes: awakeMinutes,
      sleep_score: Math.min(sleepScore, 100),
      avg_heart_rate: Math.round(rand(54, 63)),
      avg_hrv: Math.round(rand(35, 58)),
      source: "seed",
    });
  }

  return records;
}

// ─── WORKOUTS ─────────────────────────────────────────────────────────────────

const WORKOUT_TEMPLATES = [
  {
    workout_type: "cardio" as const,
    activity_name: "Running",
    baseDuration: 38,
    baseCalories: 310,
    baseDistance: 5200,
    avgHR: 158,
  },
  {
    workout_type: "strength" as const,
    activity_name: "Weight Training",
    baseDuration: 58,
    baseCalories: 260,
    baseDistance: null,
    avgHR: 135,
  },
  {
    workout_type: "cardio" as const,
    activity_name: "Cycling",
    baseDuration: 52,
    baseCalories: 380,
    baseDistance: 18000,
    avgHR: 148,
  },
  {
    workout_type: "strength" as const,
    activity_name: "Weight Training",
    baseDuration: 55,
    baseCalories: 240,
    baseDistance: null,
    avgHR: 132,
  },
];

// Workout days pattern per week (days of week, 0=Sun)
const WORKOUT_DAY_PATTERNS = [
  [1, 3, 5], // Mon, Wed, Fri
  [1, 3, 5, 6], // Mon, Wed, Fri, Sat
  [2, 4, 6], // Tue, Thu, Sat
  [1, 3, 5, 0], // Mon, Wed, Fri, Sun
  [1, 2, 4, 6], // Mon, Tue, Thu, Sat
];

function generateWorkouts(userId: string): WorkoutInsert[] {
  const workouts: WorkoutInsert[] = [];
  const today = new Date();

  // Pick a workout pattern for this user
  const pattern =
    WORKOUT_DAY_PATTERNS[Math.floor(Math.random() * WORKOUT_DAY_PATTERNS.length)];

  for (let daysAgo = 30; daysAgo >= 1; daysAgo--) {
    const date = subDays(today, daysAgo);
    const dayOfWeek = date.getDay();

    if (!pattern.includes(dayOfWeek)) continue;
    if (Math.random() < 0.15) continue; // ~15% chance to skip a scheduled day

    // Progressive improvement: older data is slightly worse
    // daysAgo 30 = week 4 back, daysAgo 1 = most recent
    const improvementFactor = 1 + ((30 - daysAgo) / 30) * 0.08; // up to 8% better over 30 days

    const template = WORKOUT_TEMPLATES[Math.floor(Math.random() * WORKOUT_TEMPLATES.length)];
    const durationVariance = rand(0.85, 1.15);
    const durationMinutes = Math.round(
      template.baseDuration * durationVariance * improvementFactor
    );

    const startHour = randInt(6, 19); // 6am–7pm
    const startedAt = setHours(startOfDay(date), startHour);
    const endedAt = addMinutes(startedAt, durationMinutes);

    const calories = Math.round(
      template.baseCalories * durationVariance * improvementFactor + rand(-20, 20)
    );
    const avgHR = Math.round(template.avgHR + rand(-8, 8));
    const maxHR = Math.round(avgHR + rand(15, 30));
    const distance = template.baseDistance
      ? Math.round(template.baseDistance * durationVariance * improvementFactor)
      : null;

    const intensityScore = Math.round(
      Math.min(((avgHR - 100) / 80) * 100 + rand(-5, 5), 100)
    );

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

function generateDailyMetrics(
  userId: string,
  workoutDates: Set<string>
): MetricsInsert[] {
  const metrics: MetricsInsert[] = [];
  const today = new Date();

  for (let daysAgo = 30; daysAgo >= 1; daysAgo--) {
    const date = subDays(today, daysAgo);
    const dateStr = format(date, "yyyy-MM-dd");
    const isWorkoutDay = workoutDates.has(dateStr);
    const isWeekend = date.getDay() === 0 || date.getDay() === 6;

    // More steps on workout days and weekends
    const baseSteps = isWorkoutDay ? randInt(8000, 12000) : randInt(5000, 9000);
    const weekendBonus = isWeekend ? randInt(0, 1500) : 0;
    const steps = baseSteps + weekendBonus;

    const activeMinutes = isWorkoutDay ? randInt(40, 90) : randInt(15, 45);

    // Resting HR: very slight downward trend (fitness improvement)
    const trendReduction = ((30 - daysAgo) / 30) * 3; // up to 3 bpm drop
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
  workoutDates: Set<string>
): CheckInInsert[] {
  const checkins: CheckInInsert[] = [];
  const today = new Date();

  for (let daysAgo = 30; daysAgo >= 0; daysAgo--) {
    const date = subDays(today, daysAgo);
    const dateStr = format(date, "yyyy-MM-dd");

    const sleepMins = sleepByDate.get(dateStr) ?? 420;
    const isWorkoutDay = workoutDates.has(dateStr);

    // Mood: correlates loosely with sleep (>= 420min = good, < 360min = poor)
    const sleepBonus = sleepMins >= 420 ? randInt(1, 2) : sleepMins < 360 ? -randInt(1, 2) : 0;
    const baseMood = randInt(5, 8);
    const mood = Math.min(10, Math.max(1, baseMood + sleepBonus));

    // Energy: correlates with sleep and slightly lower on rest days
    const baseEnergy = randInt(4, 8);
    const energyBonus = sleepMins >= 420 ? 1 : sleepMins < 360 ? -1 : 0;
    const workoutPenalty = isWorkoutDay && Math.random() < 0.3 ? -1 : 0; // post-workout tiredness
    const energy = Math.min(10, Math.max(1, baseEnergy + energyBonus + workoutPenalty));

    // Stress: slightly higher on weekdays, inversely related to sleep quality
    const isWeekend = date.getDay() === 0 || date.getDay() === 6;
    const baseStress = isWeekend ? randInt(2, 5) : randInt(3, 7);
    const stressFromSleep = sleepMins < 360 ? 1 : 0;
    const stress = Math.min(10, Math.max(1, baseStress + stressFromSleep));

    const addNote = Math.random() < 0.3;
    const notes = addNote
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

const RESULT_DETAILS_WIN = ["checkmate", "resignation", "timeout"];
const RESULT_DETAILS_LOSS = ["checkmated", "resignation", "timeout"];
const RESULT_DETAILS_DRAW = ["stalemate", "draw by agreement", "draw by repetition"];

type ChessGameInsert = {
  user_id: string;
  game_id: string;
  played_at: string;
  date: string;
  time_class: string;
  time_control: string;
  player_color: string;
  player_rating: number;
  opponent_rating: number;
  result: string;
  result_detail: string;
  accuracy: number | null;
  num_moves: number;
  duration_seconds: number;
  opening_name: string;
  raw_pgn: string | null;
};

function generateChessGames(
  userId: string,
  sleepByDate: Map<string, number>,
  workoutDates: Set<string>,
): ChessGameInsert[] {
  const games: ChessGameInsert[] = [];
  const today = new Date();

  // Rating trackers per time class
  const ratings: Record<string, number> = {
    rapid: 1100 + randInt(-10, 10),
    blitz: 1080 + randInt(-10, 10),
    bullet: 1050 + randInt(-10, 10),
  };

  // Generate 60-90 games over 30 days
  const totalGames = randInt(60, 90);
  const gamesPerDay: number[] = new Array(30).fill(0);

  // Distribute games across days (2-3 per day on average, some days 0)
  for (let i = 0; i < totalGames; i++) {
    const day = Math.floor(Math.random() * 30);
    gamesPerDay[day]++;
  }

  let gameCounter = 0;

  for (let daysAgo = 30; daysAgo >= 1; daysAgo--) {
    const date = subDays(today, daysAgo);
    const dateStr = format(date, "yyyy-MM-dd");
    const dayIndex = 30 - daysAgo;
    const numGames = gamesPerDay[dayIndex];

    if (numGames === 0) continue;

    // Check if this was a good sleep day and workout day
    const sleepMins = sleepByDate.get(dateStr) ?? 420;
    const goodSleep = sleepMins >= 420;
    const isWorkoutDay = workoutDates.has(dateStr);

    // Slight performance boost on good sleep/workout days
    const performanceBoost = (goodSleep ? 0.06 : -0.04) + (isWorkoutDay ? 0.04 : 0);

    for (let g = 0; g < numGames; g++) {
      gameCounter++;

      // Pick time class: 40% rapid, 40% blitz, 20% bullet
      const tcRoll = Math.random();
      const timeClass = tcRoll < 0.4 ? "rapid" : tcRoll < 0.8 ? "blitz" : "bullet";
      const timeControl = timeClass === "rapid" ? "600" : timeClass === "blitz" ? "180+2" : "60";

      // Game time: spread across day hours
      const hour = randInt(7, 23);
      const minute = randInt(0, 59);
      const playedAt = new Date(date);
      playedAt.setHours(hour, minute, randInt(0, 59));

      // Time-of-day performance: slightly better morning/afternoon
      const todBoost = hour >= 6 && hour < 14 ? 0.04 : hour >= 22 ? -0.06 : 0;

      // Base win rate ~52% + boosts
      const winProb = 0.52 + performanceBoost + todBoost;
      const roll = Math.random();
      const result: "win" | "loss" | "draw" = roll < winProb ? "win" : roll < winProb + 0.44 ? "loss" : "draw";

      // Rating change
      const ratingDelta = result === "win" ? randInt(5, 15) : result === "loss" ? -randInt(4, 12) : randInt(-2, 2);
      // Add slight upward trend
      const trendBoost = result === "win" ? 1 : 0;
      ratings[timeClass] = Math.max(800, ratings[timeClass] + ratingDelta + trendBoost);

      const playerRating = ratings[timeClass];
      const opponentRating = playerRating + randInt(-150, 150);

      const resultDetail = result === "win"
        ? RESULT_DETAILS_WIN[Math.floor(Math.random() * RESULT_DETAILS_WIN.length)]
        : result === "loss"
        ? RESULT_DETAILS_LOSS[Math.floor(Math.random() * RESULT_DETAILS_LOSS.length)]
        : RESULT_DETAILS_DRAW[Math.floor(Math.random() * RESULT_DETAILS_DRAW.length)];

      // Accuracy: available ~60% of games, range 55-90
      const hasAccuracy = Math.random() < 0.6;
      let accuracy: number | null = null;
      if (hasAccuracy) {
        const baseAcc = rand(55, 85);
        const sleepAccBoost = goodSleep ? rand(2, 5) : 0;
        accuracy = Math.min(Math.round((baseAcc + sleepAccBoost) * 10) / 10, 98);
      }

      const numMoves = randInt(20, 60);
      const baseDuration = timeClass === "rapid" ? 600 : timeClass === "blitz" ? 180 : 60;
      const durationSeconds = Math.round(baseDuration * rand(0.5, 1.8));

      const opening = OPENINGS[Math.floor(Math.random() * OPENINGS.length)];
      const playerColor = Math.random() < 0.5 ? "white" : "black";

      games.push({
        user_id: userId,
        game_id: `https://www.chess.com/game/live/seed-${gameCounter}`,
        played_at: playedAt.toISOString(),
        date: dateStr,
        time_class: timeClass,
        time_control: timeControl,
        player_color: playerColor,
        player_rating: playerRating,
        opponent_rating: opponentRating,
        result,
        result_detail: resultDetail,
        accuracy,
        num_moves: numMoves,
        duration_seconds: durationSeconds,
        opening_name: opening,
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
  sleep: number;
  workouts: number;
  metrics: number;
  insights: number;
  goals: number;
  checkins: number;
  chess: number;
}> {
  // Clear existing seed data for this user to make it re-runnable
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
  ]);

  const sleepRecords = generateSleepRecords(userId);
  const workoutRecords = generateWorkouts(userId);
  const workoutDateSet = new Set(workoutRecords.map((w) => w.date as string));
  const metricRecords = generateDailyMetrics(userId, workoutDateSet);
  const insightRecords = generateInsights(userId);
  const goalRecords = generateGoals(userId);
  const sleepByDate = new Map(sleepRecords.map((s) => [s.date as string, s.duration_minutes as number]));
  const checkInRecords = generateCheckIns(userId, sleepByDate, workoutDateSet);
  const chessRecords = generateChessGames(userId, sleepByDate, workoutDateSet);

  const [sleepResult, workoutResult, metricsResult, insightsResult, goalsResult, checkInsResult, chessResult] =
    await Promise.all([
      supabase.from("sleep_records").insert(sleepRecords),
      supabase.from("workouts").insert(workoutRecords),
      supabase.from("daily_metrics").insert(metricRecords),
      supabase.from("insights").insert(insightRecords),
      supabase.from("goals").insert(goalRecords),
      supabase.from("daily_checkins").insert(checkInRecords),
      supabase.from("chess_games").insert(chessRecords),
    ]);

  if (sleepResult.error) throw new Error(`Sleep insert: ${sleepResult.error.message}`);
  if (workoutResult.error) throw new Error(`Workout insert: ${workoutResult.error.message}`);
  if (metricsResult.error) throw new Error(`Metrics insert: ${metricsResult.error.message}`);
  if (insightsResult.error) throw new Error(`Insights insert: ${insightsResult.error.message}`);
  if (goalsResult.error) throw new Error(`Goals insert: ${goalsResult.error.message}`);
  if (checkInsResult.error) throw new Error(`Check-ins insert: ${checkInsResult.error.message}`);
  if (chessResult.error) throw new Error(`Chess insert: ${chessResult.error.message}`);

  // Set chess_username for demo profile
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
  };
}
