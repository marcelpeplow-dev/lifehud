import { format, subDays, parseISO } from "date-fns";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getMetricById } from "./registry";

export interface MetricResult {
  value: number | null;
  trend: "up" | "down" | "flat" | null;
  delta: number | null;
}

function calcTrend(current: number | null, prior: number | null): "up" | "down" | "flat" | null {
  if (current === null || prior === null || prior === 0) return null;
  const pct = (current - prior) / prior;
  if (pct > 0.03) return "up";
  if (pct < -0.03) return "down";
  return "flat";
}

function makeResult(value: number | null, priorValue: number | null): MetricResult {
  return {
    value,
    trend: calcTrend(value, priorValue),
    delta: value !== null && priorValue !== null ? value - priorValue : null,
  };
}

function avg(values: (number | null | undefined)[]): number | null {
  const valid = values.filter((v): v is number => v != null && isFinite(v));
  return valid.length > 0 ? valid.reduce((a, b) => a + b, 0) / valid.length : null;
}

function isoToDecimalHour(iso: string | null): number | null {
  if (!iso) return null;
  try {
    const d = parseISO(iso);
    return d.getHours() + d.getMinutes() / 60;
  } catch { return null; }
}

// ── Period helpers ─────────────────────────────────────────────────────────────

function getPeriodDates(period: "today" | "7d" | "30d" | "90d") {
  const today = new Date();
  const days = period === "today" ? 1 : period === "7d" ? 7 : period === "30d" ? 30 : 90;
  return {
    currentStart: format(subDays(today, days - 1), "yyyy-MM-dd"),
    currentEnd: format(today, "yyyy-MM-dd"),
    priorStart: format(subDays(today, days * 2 - 1), "yyyy-MM-dd"),
    priorEnd: format(subDays(today, days), "yyyy-MM-dd"),
  };
}

// ── Domain-specific fetchers ───────────────────────────────────────────────────

async function fetchSleepMetric(
  metricId: string, userId: string, supabase: SupabaseClient,
  currentStart: string, priorStart: string, priorEnd: string,
): Promise<MetricResult> {
  const fields = "duration_minutes,deep_sleep_minutes,rem_sleep_minutes,awake_minutes,avg_hrv,avg_heart_rate,sleep_score,bedtime,wake_time";
  const [{ data: curr }, { data: prior }] = await Promise.all([
    supabase.from("sleep_records").select(fields).eq("user_id", userId).gte("date", currentStart),
    supabase.from("sleep_records").select(fields).eq("user_id", userId).gte("date", priorStart).lte("date", priorEnd),
  ]);

  type SleepRow = { duration_minutes: number | null; deep_sleep_minutes: number | null; rem_sleep_minutes: number | null; awake_minutes: number | null; avg_hrv: number | null; avg_heart_rate: number | null; sleep_score: number | null; bedtime: string | null; wake_time: string | null };
  const extract = (rows: SleepRow[] | null): number | null => {
    const r = rows ?? [];
    switch (metricId) {
      case "sleep_total_duration": return avg(r.map((s) => s.duration_minutes != null ? s.duration_minutes / 60 : null));
      case "sleep_efficiency": return avg(r.map((s) => (s.duration_minutes != null && s.awake_minutes != null && s.duration_minutes + s.awake_minutes > 0) ? (s.duration_minutes / (s.duration_minutes + s.awake_minutes)) * 100 : null));
      case "sleep_deep_duration": return avg(r.map((s) => s.deep_sleep_minutes != null ? s.deep_sleep_minutes / 60 : null));
      case "sleep_deep_pct": return avg(r.map((s) => (s.deep_sleep_minutes != null && s.duration_minutes) ? (s.deep_sleep_minutes / s.duration_minutes) * 100 : null));
      case "sleep_rem_duration": return avg(r.map((s) => s.rem_sleep_minutes != null ? s.rem_sleep_minutes / 60 : null));
      case "sleep_rem_pct": return avg(r.map((s) => (s.rem_sleep_minutes != null && s.duration_minutes) ? (s.rem_sleep_minutes / s.duration_minutes) * 100 : null));
      case "sleep_hrv": return avg(r.map((s) => s.avg_hrv));
      case "sleep_resting_hr": return avg(r.map((s) => s.avg_heart_rate));
      case "sleep_score": return avg(r.map((s) => s.sleep_score));
      case "sleep_bedtime": { const latest = r.at(-1); return latest ? isoToDecimalHour(latest.bedtime) : null; }
      case "sleep_wake_time": { const latest = r.at(-1); return latest ? isoToDecimalHour(latest.wake_time) : null; }
      default: return null;
    }
  };

  const value = extract(curr as SleepRow[] | null);
  const priorValue = extract(prior as SleepRow[] | null);
  return makeResult(value, priorValue);
}

async function fetchFitnessMetric(
  metricId: string, userId: string, supabase: SupabaseClient,
  currentStart: string, priorStart: string, priorEnd: string,
): Promise<MetricResult> {
  const [
    { data: currWorkouts }, { data: priorWorkouts },
    { data: currMetrics }, { data: priorMetrics },
  ] = await Promise.all([
    supabase.from("workouts").select("duration_minutes,calories_burned,avg_heart_rate,max_heart_rate").eq("user_id", userId).gte("date", currentStart),
    supabase.from("workouts").select("duration_minutes,calories_burned,avg_heart_rate,max_heart_rate").eq("user_id", userId).gte("date", priorStart).lte("date", priorEnd),
    supabase.from("daily_metrics").select("steps,active_minutes,resting_heart_rate,hrv_average").eq("user_id", userId).gte("date", currentStart),
    supabase.from("daily_metrics").select("steps,active_minutes,resting_heart_rate,hrv_average").eq("user_id", userId).gte("date", priorStart).lte("date", priorEnd),
  ]);

  type WRow = { duration_minutes: number | null; calories_burned: number | null; avg_heart_rate: number | null; max_heart_rate: number | null };
  type MRow = { steps: number | null; active_minutes: number | null; resting_heart_rate: number | null; hrv_average: number | null };

  const extract = (w: WRow[] | null, m: MRow[] | null): number | null => {
    const ws = w ?? [], ms = m ?? [];
    switch (metricId) {
      case "fitness_workouts_per_week": return ws.length > 0 ? ws.length : null;
      case "fitness_avg_workout_duration": return avg(ws.map((r) => r.duration_minutes));
      case "fitness_active_minutes": return avg(ms.map((r) => r.active_minutes));
      case "fitness_steps": return avg(ms.map((r) => r.steps));
      case "fitness_calories": { const c = ws.reduce((s, r) => s + (r.calories_burned ?? 0), 0); return ws.length > 0 ? c / ws.length : null; }
      case "fitness_avg_workout_hr": return avg(ws.map((r) => r.avg_heart_rate));
      case "fitness_max_hr": return avg(ws.map((r) => r.max_heart_rate));
      case "fitness_resting_hr": return avg(ms.map((r) => r.resting_heart_rate));
      case "fitness_hrv": return avg(ms.map((r) => r.hrv_average));
      default: return null;
    }
  };

  const value = extract(currWorkouts as WRow[] | null, currMetrics as MRow[] | null);
  const priorValue = extract(priorWorkouts as WRow[] | null, priorMetrics as MRow[] | null);
  return makeResult(value, priorValue);
}

async function fetchChessMetric(
  metricId: string, userId: string, supabase: SupabaseClient,
  currentStart: string, priorStart: string, priorEnd: string,
): Promise<MetricResult> {
  const [{ data: curr }, { data: prior }] = await Promise.all([
    supabase.from("chess_games").select("player_rating,accuracy,result,opponent_rating,num_moves").eq("user_id", userId).gte("date", currentStart),
    supabase.from("chess_games").select("player_rating,accuracy,result,opponent_rating,num_moves").eq("user_id", userId).gte("date", priorStart).lte("date", priorEnd),
  ]);

  type GRow = { player_rating: number; accuracy: number | null; result: string; opponent_rating: number; num_moves: number | null };
  const extract = (rows: GRow[] | null): number | null => {
    const r = rows ?? [];
    if (r.length === 0) return null;
    switch (metricId) {
      case "chess_rating": return r.at(-1)?.player_rating ?? null;
      case "chess_accuracy": return avg(r.map((g) => g.accuracy));
      case "chess_games_per_week": return r.length;
      case "chess_win_rate": return (r.filter((g) => g.result === "win").length / r.length) * 100;
      case "chess_avg_opponent": return avg(r.map((g) => g.opponent_rating));
      case "chess_game_length": return avg(r.map((g) => g.num_moves));
      default: return null;
    }
  };

  const value = extract(curr as GRow[] | null);
  const priorValue = extract(prior as GRow[] | null);
  return makeResult(value, priorValue);
}

async function fetchWellbeingMetric(
  metricId: string, userId: string, supabase: SupabaseClient,
  currentStart: string, priorStart: string, priorEnd: string,
): Promise<MetricResult> {
  // Try manual_entries first, fall back to daily_checkins for mood/energy/stress
  const checkinField = metricId === "wellbeing_mood" ? "mood" : metricId === "wellbeing_energy" ? "energy" : metricId === "wellbeing_stress" ? "stress" : null;

  if (metricId === "wellbeing_journal") return { value: null, trend: null, delta: null };

  const [{ data: currManual }, { data: priorManual }, { data: currCheckin }, { data: priorCheckin }] = await Promise.all([
    supabase.from("manual_entries").select("value").eq("user_id", userId).eq("metric_id", metricId).gte("date", currentStart),
    supabase.from("manual_entries").select("value").eq("user_id", userId).eq("metric_id", metricId).gte("date", priorStart).lte("date", priorEnd),
    checkinField ? supabase.from("daily_checkins").select(checkinField).eq("user_id", userId).gte("date", currentStart) : Promise.resolve({ data: [] }),
    checkinField ? supabase.from("daily_checkins").select(checkinField).eq("user_id", userId).gte("date", priorStart).lte("date", priorEnd) : Promise.resolve({ data: [] }),
  ]);

  const manualVals = (currManual ?? []).map((r: { value: number }) => r.value);
  const priorManualVals = (priorManual ?? []).map((r: { value: number }) => r.value);
  const checkinVals = checkinField ? (currCheckin ?? []).map((r: Record<string, number>) => r[checkinField]) : [];
  const priorCheckinVals = checkinField ? (priorCheckin ?? []).map((r: Record<string, number>) => r[checkinField]) : [];

  const combined = manualVals.length > 0 ? manualVals : checkinVals;
  const priorCombined = priorManualVals.length > 0 ? priorManualVals : priorCheckinVals;

  const value = avg(combined);
  const priorValue = avg(priorCombined);
  return makeResult(value, priorValue);
}

async function fetchManualMetric(
  metricId: string, userId: string, supabase: SupabaseClient,
  currentStart: string, priorStart: string, priorEnd: string,
): Promise<MetricResult> {
  const [{ data: curr }, { data: prior }] = await Promise.all([
    supabase.from("manual_entries").select("value").eq("user_id", userId).eq("metric_id", metricId).gte("date", currentStart),
    supabase.from("manual_entries").select("value").eq("user_id", userId).eq("metric_id", metricId).gte("date", priorStart).lte("date", priorEnd),
  ]);
  const value = avg((curr ?? []).map((r: { value: number }) => r.value));
  const priorValue = avg((prior ?? []).map((r: { value: number }) => r.value));
  return makeResult(value, priorValue);
}

// ── Public API ─────────────────────────────────────────────────────────────────

export async function fetchMetricValue(
  metricId: string,
  userId: string,
  supabase: SupabaseClient,
  period: "today" | "7d" | "30d" | "90d",
): Promise<MetricResult> {
  const metric = getMetricById(metricId);
  if (!metric) return { value: null, trend: null, delta: null };

  const { currentStart, priorStart, priorEnd } = getPeriodDates(period);

  switch (metric.domain) {
    case "sleep":
      return fetchSleepMetric(metricId, userId, supabase, currentStart, priorStart, priorEnd);
    case "fitness":
      return fetchFitnessMetric(metricId, userId, supabase, currentStart, priorStart, priorEnd);
    case "chess":
      return fetchChessMetric(metricId, userId, supabase, currentStart, priorStart, priorEnd);
    case "wellbeing":
      return fetchWellbeingMetric(metricId, userId, supabase, currentStart, priorStart, priorEnd);
    default:
      return fetchManualMetric(metricId, userId, supabase, currentStart, priorStart, priorEnd);
  }
}
