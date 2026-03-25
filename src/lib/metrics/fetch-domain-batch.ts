import { format, subDays, parseISO } from "date-fns";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getMetricsByDomain } from "./registry";
import type { Domain } from "@/lib/analysis/domains";

export interface MetricBatchResult {
  metricId: string;
  today: number | null;
  avg7d: number | null;
  avg30d: number | null;
  avg90d: number | null;
  trend: "up" | "down" | "flat" | null;
}

function avg(values: (number | null | undefined)[]): number | null {
  const valid = values.filter((v): v is number => v != null && isFinite(v));
  return valid.length > 0 ? valid.reduce((a, b) => a + b, 0) / valid.length : null;
}

function calcTrend(curr: number | null, prior: number | null): "up" | "down" | "flat" | null {
  if (curr == null || prior == null || prior === 0) return null;
  const pct = (curr - prior) / prior;
  if (pct > 0.03) return "up";
  if (pct < -0.03) return "down";
  return "flat";
}

function isoToHour(iso: string | null): number | null {
  if (!iso) return null;
  try { const d = parseISO(iso); return d.getHours() + d.getMinutes() / 60; }
  catch { return null; }
}

// ── Sleep ──────────────────────────────────────────────────────────────────────

async function fetchSleepBatch(userId: string, supabase: SupabaseClient): Promise<MetricBatchResult[]> {
  const today = new Date();
  const s90 = format(subDays(today, 89), "yyyy-MM-dd");
  const s30 = format(subDays(today, 29), "yyyy-MM-dd");
  const s7 = format(subDays(today, 6), "yyyy-MM-dd");
  const s2 = format(subDays(today, 1), "yyyy-MM-dd");
  const prior7End = format(subDays(today, 7), "yyyy-MM-dd");
  const prior7Start = format(subDays(today, 13), "yyyy-MM-dd");

  const { data } = await supabase
    .from("sleep_records")
    .select("date,duration_minutes,deep_sleep_minutes,rem_sleep_minutes,awake_minutes,avg_hrv,avg_heart_rate,bedtime,wake_time")
    .eq("user_id", userId).gte("date", s90).order("date");

  type SR = { date: string; duration_minutes: number | null; deep_sleep_minutes: number | null; rem_sleep_minutes: number | null; awake_minutes: number | null; avg_hrv: number | null; avg_heart_rate: number | null; bedtime: string | null; wake_time: string | null };
  const rows = (data ?? []) as SR[];

  function extract(r: SR[], metricId: string): number | null {
    if (r.length === 0) return null;
    switch (metricId) {
      case "sleep_total_duration": return avg(r.map((s) => s.duration_minutes != null ? s.duration_minutes / 60 : null));
      case "sleep_efficiency": return avg(r.map((s) => (s.duration_minutes != null && s.awake_minutes != null && s.duration_minutes + s.awake_minutes > 0) ? (s.duration_minutes / (s.duration_minutes + s.awake_minutes)) * 100 : null));
      case "sleep_deep_duration": return avg(r.map((s) => s.deep_sleep_minutes != null ? s.deep_sleep_minutes / 60 : null));
      case "sleep_deep_pct": return avg(r.map((s) => (s.deep_sleep_minutes != null && s.duration_minutes) ? (s.deep_sleep_minutes / s.duration_minutes) * 100 : null));
      case "sleep_rem_duration": return avg(r.map((s) => s.rem_sleep_minutes != null ? s.rem_sleep_minutes / 60 : null));
      case "sleep_rem_pct": return avg(r.map((s) => (s.rem_sleep_minutes != null && s.duration_minutes) ? (s.rem_sleep_minutes / s.duration_minutes) * 100 : null));
      case "sleep_hrv": return avg(r.map((s) => s.avg_hrv));
      case "sleep_resting_hr": return avg(r.map((s) => s.avg_heart_rate));
      case "sleep_bedtime": { const last = r.at(-1); return last ? isoToHour(last.bedtime) : null; }
      case "sleep_wake_time": { const last = r.at(-1); return last ? isoToHour(last.wake_time) : null; }
      default: return null;
    }
  }

  const todayRows = rows.filter((r) => r.date >= s2);
  const todaySingle = todayRows.length > 0 ? [todayRows[todayRows.length - 1]] : [];
  const rows7 = rows.filter((r) => r.date >= s7);
  const rows30 = rows.filter((r) => r.date >= s30);
  const prior7 = rows.filter((r) => r.date >= prior7Start && r.date <= prior7End);

  return getMetricsByDomain("sleep")
    .filter((m) => m.unit !== "text")
    .map((m) => ({
      metricId: m.id,
      today: extract(todaySingle, m.id),
      avg7d: extract(rows7, m.id),
      avg30d: extract(rows30, m.id),
      avg90d: extract(rows, m.id),
      trend: calcTrend(extract(rows7, m.id), extract(prior7, m.id)),
    }));
}

// ── Fitness ────────────────────────────────────────────────────────────────────

async function fetchFitnessBatch(userId: string, supabase: SupabaseClient): Promise<MetricBatchResult[]> {
  const today = new Date();
  const s90 = format(subDays(today, 89), "yyyy-MM-dd");
  const s30 = format(subDays(today, 29), "yyyy-MM-dd");
  const s7 = format(subDays(today, 6), "yyyy-MM-dd");
  const todayStr = format(today, "yyyy-MM-dd");
  const prior7End = format(subDays(today, 7), "yyyy-MM-dd");
  const prior7Start = format(subDays(today, 13), "yyyy-MM-dd");

  const [{ data: wData }, { data: mData }] = await Promise.all([
    supabase.from("workouts").select("date,duration_minutes,calories_burned,avg_heart_rate,max_heart_rate").eq("user_id", userId).gte("date", s90).order("date"),
    supabase.from("daily_metrics").select("date,steps,active_minutes,resting_heart_rate,hrv_average").eq("user_id", userId).gte("date", s90).order("date"),
  ]);

  type WR = { date: string; duration_minutes: number | null; calories_burned: number | null; avg_heart_rate: number | null; max_heart_rate: number | null };
  type MR = { date: string; steps: number | null; active_minutes: number | null; resting_heart_rate: number | null; hrv_average: number | null };
  const wRows = (wData ?? []) as WR[];
  const mRows = (mData ?? []) as MR[];

  function extract(ws: WR[], ms: MR[], metricId: string): number | null {
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
  }

  const filter = (start: string, end?: string) => ({
    ws: wRows.filter((r) => r.date >= start && (!end || r.date <= end)),
    ms: mRows.filter((r) => r.date >= start && (!end || r.date <= end)),
  });

  const f = { today: filter(todayStr), w7: filter(s7), w30: filter(s30), w90: filter(s90), prior: filter(prior7Start, prior7End) };

  return getMetricsByDomain("fitness")
    .filter((m) => m.unit !== "text" && m.unit !== "category")
    .map((m) => ({
      metricId: m.id,
      today: extract(f.today.ws, f.today.ms, m.id),
      avg7d: extract(f.w7.ws, f.w7.ms, m.id),
      avg30d: extract(f.w30.ws, f.w30.ms, m.id),
      avg90d: extract(f.w90.ws, f.w90.ms, m.id),
      trend: calcTrend(extract(f.w7.ws, f.w7.ms, m.id), extract(f.prior.ws, f.prior.ms, m.id)),
    }));
}

// ── Chess ──────────────────────────────────────────────────────────────────────

async function fetchChessBatch(userId: string, supabase: SupabaseClient): Promise<MetricBatchResult[]> {
  const today = new Date();
  const s90 = format(subDays(today, 89), "yyyy-MM-dd");
  const s30 = format(subDays(today, 29), "yyyy-MM-dd");
  const s7 = format(subDays(today, 6), "yyyy-MM-dd");
  const todayStr = format(today, "yyyy-MM-dd");
  const prior7End = format(subDays(today, 7), "yyyy-MM-dd");
  const prior7Start = format(subDays(today, 13), "yyyy-MM-dd");

  const { data } = await supabase
    .from("chess_games")
    .select("date,player_rating,accuracy,result,opponent_rating,num_moves")
    .eq("user_id", userId).gte("date", s90).order("date");

  type GR = { date: string; player_rating: number; accuracy: number | null; result: string; opponent_rating: number; num_moves: number | null };
  const rows = (data ?? []) as GR[];

  function extract(r: GR[], metricId: string): number | null {
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
  }

  const filterRows = (start: string, end?: string) => rows.filter((r) => r.date >= start && (!end || r.date <= end));
  const todayRows = filterRows(todayStr);
  const rows7 = filterRows(s7);
  const rows30 = filterRows(s30);
  const prior7 = filterRows(prior7Start, prior7End);

  return getMetricsByDomain("chess")
    .filter((m) => m.unit !== "text" && m.unit !== "category" && m.unit !== "name" && m.unit !== "ratio" && m.unit !== "hour")
    .map((m) => ({
      metricId: m.id,
      today: extract(todayRows, m.id),
      avg7d: extract(rows7, m.id),
      avg30d: extract(rows30, m.id),
      avg90d: extract(rows, m.id),
      trend: calcTrend(extract(rows7, m.id), extract(prior7, m.id)),
    }));
}

// ── Manual (wellbeing + other manual domains) ─────────────────────────────────

async function fetchManualBatch(domain: Domain, userId: string, supabase: SupabaseClient): Promise<MetricBatchResult[]> {
  const today = new Date();
  const s90 = format(subDays(today, 89), "yyyy-MM-dd");
  const s30 = format(subDays(today, 29), "yyyy-MM-dd");
  const s7 = format(subDays(today, 6), "yyyy-MM-dd");
  const todayStr = format(today, "yyyy-MM-dd");
  const prior7End = format(subDays(today, 7), "yyyy-MM-dd");
  const prior7Start = format(subDays(today, 13), "yyyy-MM-dd");

  const domainMetrics = getMetricsByDomain(domain).filter((m) => m.unit !== "text");
  const metricIds = domainMetrics.map((m) => m.id);

  const checkinFields = ["wellbeing_mood", "wellbeing_energy", "wellbeing_stress"];
  const hasCheckins = domain === "wellbeing";

  const [{ data: manualData }, { data: checkinData }] = await Promise.all([
    supabase.from("manual_entries").select("date,metric_id,value").eq("user_id", userId).in("metric_id", metricIds).gte("date", s90).order("date"),
    hasCheckins
      ? supabase.from("daily_checkins").select("date,mood,energy,stress").eq("user_id", userId).gte("date", s90).order("date")
      : Promise.resolve({ data: [] }),
  ]);

  type ME = { date: string; metric_id: string; value: number };
  type CI = { date: string; mood: number; energy: number; stress: number };
  const manualRows = (manualData ?? []) as ME[];
  const checkinRows = (checkinData ?? []) as CI[];

  function getValues(metricId: string, start: string, end?: string): number[] {
    const filtered = manualRows.filter((r) => r.metric_id === metricId && r.date >= start && (!end || r.date <= end));
    if (filtered.length > 0) return filtered.map((r) => r.value);
    // Fall back to daily_checkins for wellbeing metrics
    const field = metricId === "wellbeing_mood" ? "mood" : metricId === "wellbeing_energy" ? "energy" : metricId === "wellbeing_stress" ? "stress" : null;
    if (!field) return [];
    return checkinRows.filter((r) => r.date >= start && (!end || r.date <= end)).map((r) => r[field as keyof typeof r] as number).filter((v) => v != null);
  }

  return domainMetrics.map((m) => {
    const todayVals = getValues(m.id, todayStr);
    const v7 = avg(getValues(m.id, s7));
    const v30 = avg(getValues(m.id, s30));
    const v90 = avg(getValues(m.id, s90));
    const vPrior = avg(getValues(m.id, prior7Start, prior7End));
    return {
      metricId: m.id,
      today: todayVals.length > 0 ? avg(todayVals) : null,
      avg7d: v7,
      avg30d: v30,
      avg90d: v90,
      trend: calcTrend(v7, vPrior),
    };
  });
}

// ── Public API ─────────────────────────────────────────────────────────────────

export async function fetchDomainMetricsBatch(
  domain: Domain,
  userId: string,
  supabase: SupabaseClient,
): Promise<MetricBatchResult[]> {
  switch (domain) {
    case "sleep": return fetchSleepBatch(userId, supabase);
    case "fitness": return fetchFitnessBatch(userId, supabase);
    case "chess": return fetchChessBatch(userId, supabase);
    default: return fetchManualBatch(domain, userId, supabase);
  }
}
