import { format, subDays, eachDayOfInterval, parseISO } from "date-fns";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getMetricById } from "./registry";

export type SeriesPoint = { date: string; value: number | null };

function avg(values: (number | null | undefined)[]): number | null {
  const valid = values.filter((v): v is number => v != null && isFinite(v));
  return valid.length > 0 ? valid.reduce((a, b) => a + b, 0) / valid.length : null;
}

function isoToDecimalHour(iso: string | null): number | null {
  if (!iso) return null;
  try { const d = parseISO(iso); return d.getHours() + d.getMinutes() / 60; }
  catch { return null; }
}

function buildDateRange(days: 7 | 30 | 90): string[] {
  const today = new Date();
  return eachDayOfInterval({ start: subDays(today, days - 1), end: today })
    .map((d) => format(d, "yyyy-MM-dd"));
}

async function fetchSleepSeries(
  metricId: string, userId: string, supabase: SupabaseClient, dates: string[],
): Promise<SeriesPoint[]> {
  const { data } = await supabase
    .from("sleep_records")
    .select("date,duration_minutes,deep_sleep_minutes,rem_sleep_minutes,awake_minutes,avg_hrv,avg_heart_rate,bedtime,wake_time")
    .eq("user_id", userId).gte("date", dates[0]).order("date");

  type SR = { date: string; duration_minutes: number | null; deep_sleep_minutes: number | null; rem_sleep_minutes: number | null; awake_minutes: number | null; avg_hrv: number | null; avg_heart_rate: number | null; bedtime: string | null; wake_time: string | null };
  const byDate = new Map<string, SR[]>();
  for (const row of (data ?? []) as SR[]) {
    const arr = byDate.get(row.date) ?? [];
    arr.push(row);
    byDate.set(row.date, arr);
  }

  return dates.map((date) => {
    const r = byDate.get(date) ?? [];
    let value: number | null = null;
    switch (metricId) {
      case "sleep_total_duration": value = avg(r.map((s) => s.duration_minutes != null ? s.duration_minutes / 60 : null)); break;
      case "sleep_efficiency": value = avg(r.map((s) => (s.duration_minutes != null && s.awake_minutes != null && s.duration_minutes + s.awake_minutes > 0) ? (s.duration_minutes / (s.duration_minutes + s.awake_minutes)) * 100 : null)); break;
      case "sleep_deep_duration": value = avg(r.map((s) => s.deep_sleep_minutes != null ? s.deep_sleep_minutes / 60 : null)); break;
      case "sleep_deep_pct": value = avg(r.map((s) => (s.deep_sleep_minutes != null && s.duration_minutes) ? (s.deep_sleep_minutes / s.duration_minutes) * 100 : null)); break;
      case "sleep_rem_duration": value = avg(r.map((s) => s.rem_sleep_minutes != null ? s.rem_sleep_minutes / 60 : null)); break;
      case "sleep_rem_pct": value = avg(r.map((s) => (s.rem_sleep_minutes != null && s.duration_minutes) ? (s.rem_sleep_minutes / s.duration_minutes) * 100 : null)); break;
      case "sleep_hrv": value = avg(r.map((s) => s.avg_hrv)); break;
      case "sleep_resting_hr": value = avg(r.map((s) => s.avg_heart_rate)); break;
      case "sleep_bedtime": { const last = r.at(-1); value = last ? isoToDecimalHour(last.bedtime) : null; break; }
      case "sleep_wake_time": { const last = r.at(-1); value = last ? isoToDecimalHour(last.wake_time) : null; break; }
    }
    return { date, value };
  });
}

async function fetchFitnessSeries(
  metricId: string, userId: string, supabase: SupabaseClient, dates: string[],
): Promise<SeriesPoint[]> {
  const [{ data: workouts }, { data: metrics }] = await Promise.all([
    supabase.from("workouts").select("date,duration_minutes,calories_burned,avg_heart_rate,max_heart_rate").eq("user_id", userId).gte("date", dates[0]).order("date"),
    supabase.from("daily_metrics").select("date,steps,active_minutes,resting_heart_rate,hrv_average").eq("user_id", userId).gte("date", dates[0]).order("date"),
  ]);

  type WR = { date: string; duration_minutes: number | null; calories_burned: number | null; avg_heart_rate: number | null; max_heart_rate: number | null };
  type MR = { date: string; steps: number | null; active_minutes: number | null; resting_heart_rate: number | null; hrv_average: number | null };

  const wByDate = new Map<string, WR[]>();
  for (const row of (workouts ?? []) as WR[]) {
    const arr = wByDate.get(row.date) ?? [];
    arr.push(row);
    wByDate.set(row.date, arr);
  }
  const mByDate = new Map<string, MR>();
  for (const row of (metrics ?? []) as MR[]) mByDate.set(row.date, row);

  return dates.map((date) => {
    const ws = wByDate.get(date) ?? [];
    const m = mByDate.get(date);
    let value: number | null = null;
    switch (metricId) {
      case "fitness_workouts_per_week": value = ws.length > 0 ? ws.length : null; break;
      case "fitness_avg_workout_duration": value = avg(ws.map((r) => r.duration_minutes)); break;
      case "fitness_active_minutes": value = m?.active_minutes ?? null; break;
      case "fitness_steps": value = m?.steps ?? null; break;
      case "fitness_calories": { const c = ws.reduce((s, r) => s + (r.calories_burned ?? 0), 0); value = ws.length > 0 ? c : null; break; }
      case "fitness_avg_workout_hr": value = avg(ws.map((r) => r.avg_heart_rate)); break;
      case "fitness_max_hr": value = avg(ws.map((r) => r.max_heart_rate)); break;
      case "fitness_resting_hr": value = m?.resting_heart_rate ?? null; break;
      case "fitness_hrv": value = m?.hrv_average ?? null; break;
    }
    return { date, value };
  });
}

async function fetchChessSeries(
  metricId: string, userId: string, supabase: SupabaseClient, dates: string[],
): Promise<SeriesPoint[]> {
  const { data } = await supabase
    .from("chess_games")
    .select("date,player_rating,accuracy,result,opponent_rating,num_moves")
    .eq("user_id", userId).gte("date", dates[0]).order("date");

  type GR = { date: string; player_rating: number; accuracy: number | null; result: string; opponent_rating: number; num_moves: number | null };
  const byDate = new Map<string, GR[]>();
  for (const row of (data ?? []) as GR[]) {
    const arr = byDate.get(row.date) ?? [];
    arr.push(row);
    byDate.set(row.date, arr);
  }

  return dates.map((date) => {
    const r = byDate.get(date) ?? [];
    if (r.length === 0) return { date, value: null };
    let value: number | null = null;
    switch (metricId) {
      case "chess_rating": value = r.at(-1)?.player_rating ?? null; break;
      case "chess_accuracy": value = avg(r.map((g) => g.accuracy)); break;
      case "chess_games_per_week": value = r.length; break;
      case "chess_win_rate": value = (r.filter((g) => g.result === "win").length / r.length) * 100; break;
      case "chess_avg_opponent": value = avg(r.map((g) => g.opponent_rating)); break;
      case "chess_game_length": value = avg(r.map((g) => g.num_moves)); break;
    }
    return { date, value };
  });
}

async function fetchManualSeries(
  metricId: string, userId: string, supabase: SupabaseClient, dates: string[],
): Promise<SeriesPoint[]> {
  const checkinField = metricId === "wellbeing_mood" ? "mood" : metricId === "wellbeing_energy" ? "energy" : metricId === "wellbeing_stress" ? "stress" : null;

  const [{ data: manual }, { data: checkins }] = await Promise.all([
    supabase.from("manual_entries").select("date,value").eq("user_id", userId).eq("metric_id", metricId).gte("date", dates[0]).order("date"),
    checkinField
      ? supabase.from("daily_checkins").select(`date,${checkinField}`).eq("user_id", userId).gte("date", dates[0]).order("date")
      : Promise.resolve({ data: [] }),
  ]);

  const manualByDate = new Map<string, number[]>();
  for (const row of (manual ?? []) as { date: string; value: number }[]) {
    const arr = manualByDate.get(row.date) ?? [];
    arr.push(row.value);
    manualByDate.set(row.date, arr);
  }
  const checkinByDate = new Map<string, number>();
  if (checkinField) {
    for (const row of (checkins ?? []) as Record<string, string | number>[]) {
      checkinByDate.set(row["date"] as string, row[checkinField] as number);
    }
  }

  return dates.map((date) => {
    const manualVals = manualByDate.get(date);
    if (manualVals && manualVals.length > 0) return { date, value: avg(manualVals) };
    return { date, value: checkinByDate.get(date) ?? null };
  });
}

export async function fetchMetricSeries(
  metricId: string,
  userId: string,
  supabase: SupabaseClient,
  days: 7 | 30 | 90,
): Promise<SeriesPoint[]> {
  const metric = getMetricById(metricId);
  if (!metric) return [];
  const dates = buildDateRange(days);
  switch (metric.domain) {
    case "sleep": return fetchSleepSeries(metricId, userId, supabase, dates);
    case "fitness": return fetchFitnessSeries(metricId, userId, supabase, dates);
    case "chess": return fetchChessSeries(metricId, userId, supabase, dates);
    default: return fetchManualSeries(metricId, userId, supabase, dates);
  }
}
