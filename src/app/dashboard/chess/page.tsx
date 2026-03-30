import { format, subDays, parseISO, startOfMonth } from "date-fns";
import { createClient } from "@/lib/supabase/server";
import { DomainPageTemplate } from "@/components/domain/DomainPageTemplate";
import { ResultsBreakdown } from "@/components/charts/ResultsBreakdown";
import { TimeOfDayChart } from "@/components/charts/TimeOfDayChart";
import { formatShortDate } from "@/lib/utils/dates";
import type { ChessGame } from "@/types/index";
import { redirect } from "next/navigation";

function getTimeSlot(hour: number): string {
  if (hour >= 6 && hour < 12) return "Morning";
  if (hour >= 12 && hour < 18) return "Afternoon";
  if (hour >= 18 && hour < 24) return "Evening";
  return "Night";
}

export default async function ChessPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const today = new Date();
  const thirtyDaysAgo = format(subDays(today, 29), "yyyy-MM-dd");

  const { data: gamesData } = await supabase
    .from("chess_games")
    .select("*")
    .eq("user_id", user.id)
    .gte("date", thirtyDaysAgo)
    .order("played_at", { ascending: true });

  const games = (gamesData ?? []) as ChessGame[];
  const recentGames = [...games].reverse().slice(0, 5);

  // Results breakdown by time control
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

  // Time of day performance
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

  return (
    <DomainPageTemplate domain="chess" userId={user.id}>
      {/* Chess-specific analytics */}
      {games.length > 0 && (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {resultsData.length > 0 && (
              <section className="bg-zinc-900 border border-zinc-800 rounded-xl p-5">
                <p className="text-sm font-medium text-zinc-50 mb-1">Results breakdown</p>
                <p className="text-xs text-zinc-500 mb-4">Win / draw / loss by time control · last 30 days</p>
                <ResultsBreakdown data={resultsData} />
              </section>
            )}
            <section className="bg-zinc-900 border border-zinc-800 rounded-xl p-5">
              <p className="text-sm font-medium text-zinc-50 mb-1">Performance by time of day</p>
              <p className="text-xs text-zinc-500 mb-4">Win rate by session time · last 30 days</p>
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
                <div className="hidden md:grid grid-cols-[1fr_80px_60px_60px_56px_70px_1fr] gap-2 px-5 py-2.5 border-b border-zinc-800 text-xs font-medium text-zinc-500">
                  <span>Date</span>
                  <span>Format</span>
                  <span className="text-right">Rating</span>
                  <span className="text-right">Opp. Rating</span>
                  <span className="text-center">Result</span>
                  <span className="text-right">Accuracy</span>
                  <span>Opening</span>
                </div>
                <div className="divide-y divide-zinc-800">
                  {recentGames.map((game) => {
                    const resultColor = game.result === "win" ? "text-emerald-400" : game.result === "loss" ? "text-red-400" : "text-zinc-400";
                    const resultLabel = game.result === "win" ? "W" : game.result === "loss" ? "L" : "D";
                    return (
                      <div key={game.id} className="grid grid-cols-2 md:grid-cols-[1fr_80px_60px_60px_56px_70px_1fr] gap-2 px-5 py-3 items-center text-sm">
                        <span className="text-zinc-300 text-xs">{format(parseISO(game.played_at), "MMM d, h:mm a")}</span>
                        <span className="text-zinc-400 text-xs capitalize">{game.time_class}</span>
                        <span className="text-zinc-200 text-xs tabular-nums text-right">{game.player_rating}</span>
                        <span className="text-zinc-400 text-xs tabular-nums text-right">{game.opponent_rating}</span>
                        <span className={`text-xs font-semibold text-center ${resultColor}`}>{resultLabel}</span>
                        <span className="text-zinc-400 text-xs tabular-nums text-right">
                          {game.accuracy !== null ? `${Math.round(game.accuracy)}%` : "—"}
                        </span>
                        <span className="text-zinc-500 text-xs truncate">{game.opening_name ?? "—"}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            </section>
          )}
        </>
      )}
    </DomainPageTemplate>
  );
}
