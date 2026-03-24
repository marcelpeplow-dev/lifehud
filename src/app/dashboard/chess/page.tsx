import { Suspense } from "react";
import { format, subDays, parseISO, startOfMonth } from "date-fns";
import { createClient } from "@/lib/supabase/server";
import { DateRangeSelector } from "@/components/sleep/DateRangeSelector";
import { RatingChart } from "@/components/charts/RatingChart";
import { ResultsBreakdown } from "@/components/charts/ResultsBreakdown";
import { TimeOfDayChart } from "@/components/charts/TimeOfDayChart";
import { formatShortDate } from "@/lib/utils/dates";
import type { DateRange, ChessGame } from "@/types/index";
import { redirect } from "next/navigation";

function rangeToDays(range: DateRange): number {
  if (range === "30d") return 30;
  if (range === "90d") return 90;
  return 7;
}

function StatCard({
  label,
  value,
  sub,
  color = "text-zinc-50",
}: {
  label: string;
  value: string;
  sub: string;
  color?: string;
}) {
  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5">
      <p className="text-xs font-medium text-zinc-400 mb-3">{label}</p>
      <p className={`text-2xl font-semibold tabular-nums mb-1 ${color}`}>{value}</p>
      <p className="text-xs text-zinc-500">{sub}</p>
    </div>
  );
}

function getTimeSlot(hour: number): string {
  if (hour >= 6 && hour < 12) return "Morning";
  if (hour >= 12 && hour < 18) return "Afternoon";
  if (hour >= 18 && hour < 24) return "Evening";
  return "Night";
}

export default async function ChessPage({
  searchParams,
}: {
  searchParams: Promise<{ range?: string }>;
}) {
  const { range: rawRange = "30d" } = await searchParams;
  const range = (["7d", "30d", "90d"].includes(rawRange) ? rawRange : "30d") as DateRange;
  const days = rangeToDays(range);

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const today = new Date();
  const startDate = format(subDays(today, days - 1), "yyyy-MM-dd");

  const { data: gamesData } = await supabase
    .from("chess_games")
    .select("*")
    .eq("user_id", user.id)
    .gte("date", startDate)
    .order("played_at", { ascending: true });

  const games = (gamesData ?? []) as ChessGame[];

  // ── Top stat cards ──────────────────────────────────────────────────────────

  // Current ratings (latest game per time class)
  function latestRating(tc: string): number | null {
    const tcGames = games.filter((g) => g.time_class === tc);
    if (tcGames.length === 0) return null;
    return tcGames[tcGames.length - 1].player_rating;
  }

  function ratingTrend(tc: string): number | null {
    const tcGames = games.filter((g) => g.time_class === tc);
    if (tcGames.length < 2) return null;
    return tcGames[tcGames.length - 1].player_rating - tcGames[0].player_rating;
  }

  const rapidRating = latestRating("rapid");
  const blitzRating = latestRating("blitz");
  const rapidTrend = ratingTrend("rapid");
  const blitzTrend = ratingTrend("blitz");

  // Win rate this month
  const monthStart = format(startOfMonth(today), "yyyy-MM-dd");
  const monthGames = games.filter((g) => g.date >= monthStart);
  const monthWins = monthGames.filter((g) => g.result === "win").length;
  const monthWinRate = monthGames.length > 0 ? Math.round((monthWins / monthGames.length) * 100) : null;

  // Games this week
  const weekStart = format(subDays(today, 6), "yyyy-MM-dd");
  const weekGames = games.filter((g) => g.date >= weekStart);

  function trendArrow(trend: number | null): string {
    if (trend === null) return "";
    if (trend > 0) return `+${trend}`;
    return `${trend}`;
  }

  // ── Rating chart data ─────────────────────────────────────────────────────

  // Build per-game rating data points grouped by date for the line chart
  const ratingChartData: { date: string; label: string; rapid: number | null; blitz: number | null; bullet: number | null }[] = [];
  const seenDates = new Map<string, { rapid: number | null; blitz: number | null; bullet: number | null }>();

  for (const game of games) {
    const d = game.date;
    if (!seenDates.has(d)) {
      seenDates.set(d, { rapid: null, blitz: null, bullet: null });
    }
    const entry = seenDates.get(d)!;
    if (game.time_class === "rapid") entry.rapid = game.player_rating;
    if (game.time_class === "blitz") entry.blitz = game.player_rating;
    if (game.time_class === "bullet") entry.bullet = game.player_rating;
  }

  for (const [date, ratings] of seenDates) {
    ratingChartData.push({
      date,
      label: formatShortDate(date),
      ...ratings,
    });
  }

  // ── Results breakdown ─────────────────────────────────────────────────────

  const timeClasses = ["rapid", "blitz", "bullet", "daily"];
  const resultsData = timeClasses
    .map((tc) => {
      const tcGames = games.filter((g) => g.time_class === tc);
      if (tcGames.length === 0) return null;
      return {
        timeClass: tc,
        wins: tcGames.filter((g) => g.result === "win").length,
        losses: tcGames.filter((g) => g.result === "loss").length,
        draws: tcGames.filter((g) => g.result === "draw").length,
        total: tcGames.length,
      };
    })
    .filter((d): d is NonNullable<typeof d> => d !== null);

  // ── Time of day performance ────────────────────────────────────────────────

  const slots = ["Morning", "Afternoon", "Evening", "Night"];
  const timeOfDayData = slots.map((slot) => {
    const slotGames = games.filter((g) => {
      const hour = parseISO(g.played_at).getHours();
      return getTimeSlot(hour) === slot;
    });
    const wins = slotGames.filter((g) => g.result === "win").length;
    return {
      slot,
      winRate: slotGames.length > 0 ? Math.round((wins / slotGames.length) * 100) : 0,
      games: slotGames.length,
    };
  });

  // ── Recent games ──────────────────────────────────────────────────────────

  const recentGames = [...games].reverse().slice(0, 20);

  const noGames = games.length === 0;

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-semibold text-zinc-50 tracking-tight">Chess</h1>
          <p className="text-sm text-zinc-400 mt-0.5">Rating trends, results, and performance analysis</p>
        </div>
        <Suspense>
          <DateRangeSelector active={range} />
        </Suspense>
      </div>

      {noGames ? (
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-8 text-center">
          <p className="text-zinc-400 mb-2">No chess games found for this period.</p>
          <p className="text-xs text-zinc-500">Connect your Chess.com or Lichess account in Settings to sync games.</p>
        </div>
      ) : (
        <>
          {/* Stats */}
          <section className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <StatCard
              label="Rapid rating"
              value={rapidRating !== null ? `${rapidRating}` : "—"}
              sub={rapidTrend !== null ? `${trendArrow(rapidTrend)} this period` : "No data"}
              color={rapidTrend !== null && rapidTrend > 0 ? "text-emerald-400" : rapidTrend !== null && rapidTrend < 0 ? "text-red-400" : "text-zinc-50"}
            />
            <StatCard
              label="Blitz rating"
              value={blitzRating !== null ? `${blitzRating}` : "—"}
              sub={blitzTrend !== null ? `${trendArrow(blitzTrend)} this period` : "No data"}
              color={blitzTrend !== null && blitzTrend > 0 ? "text-emerald-400" : blitzTrend !== null && blitzTrend < 0 ? "text-red-400" : "text-zinc-50"}
            />
            <StatCard
              label="Win rate"
              value={monthWinRate !== null ? `${monthWinRate}%` : "—"}
              sub={monthGames.length > 0 ? `${monthGames.length} games this month` : "No games this month"}
              color={monthWinRate !== null && monthWinRate >= 50 ? "text-emerald-400" : "text-zinc-50"}
            />
            <StatCard
              label="This week"
              value={`${weekGames.length}`}
              sub={`game${weekGames.length !== 1 ? "s" : ""} played`}
            />
          </section>

          {/* Rating trend chart */}
          <section className="bg-zinc-900 border border-zinc-800 rounded-xl p-5">
            <p className="text-sm font-medium text-zinc-50 mb-1">Rating trend</p>
            <p className="text-xs text-zinc-500 mb-4">Rating after each game · last {days} days</p>
            <RatingChart data={ratingChartData} />
          </section>

          {/* Results + Time of day side by side */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <section className="bg-zinc-900 border border-zinc-800 rounded-xl p-5">
              <p className="text-sm font-medium text-zinc-50 mb-1">Results breakdown</p>
              <p className="text-xs text-zinc-500 mb-4">Win / draw / loss by time control</p>
              <ResultsBreakdown data={resultsData} />
            </section>

            <section className="bg-zinc-900 border border-zinc-800 rounded-xl p-5">
              <p className="text-sm font-medium text-zinc-50 mb-1">Performance by time of day</p>
              <p className="text-xs text-zinc-500 mb-4">Win rate by session time</p>
              <TimeOfDayChart data={timeOfDayData} />
            </section>
          </div>

          {/* Recent games */}
          {recentGames.length > 0 && (
            <section>
              <h2 className="text-sm font-semibold text-zinc-400 uppercase tracking-widest mb-3">
                Recent games
              </h2>
              <div className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden">
                {/* Table header */}
                <div className="hidden md:grid grid-cols-[1fr_80px_50px_70px_70px_60px_60px_1fr] gap-2 px-5 py-2.5 border-b border-zinc-800 text-xs font-medium text-zinc-500">
                  <span>Date</span>
                  <span>Format</span>
                  <span>Src</span>
                  <span className="text-right">Rating</span>
                  <span className="text-right">Opp.</span>
                  <span className="text-center">Result</span>
                  <span className="text-right">Acc.</span>
                  <span>Opening</span>
                </div>
                <div className="divide-y divide-zinc-800">
                  {recentGames.map((game) => {
                    const resultColor =
                      game.result === "win"
                        ? "text-emerald-400"
                        : game.result === "loss"
                        ? "text-red-400"
                        : "text-zinc-400";
                    const resultLabel =
                      game.result === "win" ? "W" : game.result === "loss" ? "L" : "D";
                    return (
                      <div
                        key={game.id}
                        className="grid grid-cols-2 md:grid-cols-[1fr_80px_50px_70px_70px_60px_60px_1fr] gap-2 px-5 py-3 items-center text-sm"
                      >
                        <span className="text-zinc-300 text-xs">
                          {format(parseISO(game.played_at), "MMM d, h:mm a")}
                        </span>
                        <span className="text-zinc-400 text-xs capitalize">{game.time_class}</span>
                        <span className="text-zinc-500 text-xs">
                          {game.source === "lichess" ? "Li" : "CC"}
                        </span>
                        <span className="text-zinc-200 text-xs tabular-nums text-right">{game.player_rating}</span>
                        <span className="text-zinc-400 text-xs tabular-nums text-right">{game.opponent_rating}</span>
                        <span className={`text-xs font-semibold text-center ${resultColor}`}>
                          {resultLabel}
                        </span>
                        <span className="text-zinc-400 text-xs tabular-nums text-right">
                          {game.accuracy !== null ? `${Math.round(game.accuracy)}%` : "—"}
                        </span>
                        <span className="text-zinc-500 text-xs truncate">
                          {game.opening_name ?? "—"}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            </section>
          )}
        </>
      )}
    </div>
  );
}
