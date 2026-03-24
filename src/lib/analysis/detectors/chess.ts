import { format, subDays, parseISO } from "date-fns";
import { registerDetector } from "../detector-registry";
import type { UserDataBundle } from "../data-bundle";
import type { ChessGame } from "@/types/index";
import { mean, winRate, avgAccuracy, effectToSignificance } from "./utils";

// ── CHESS_RATING_TREND: Rating change per time class over 30 days ────────────
for (const tc of ["rapid", "blitz", "bullet"] as const) {
  registerDetector({
    id: `CHESS_RATING_TREND_${tc.toUpperCase()}`,
    name: `Chess ${tc} rating trend`,
    requiredDomains: ["chess"],
    category: "single",
    detect: (data: UserDataBundle) => {
      const cutoff = format(subDays(new Date(), 30), "yyyy-MM-dd");
      const tcGames = data.chessGames.filter(
        (g) => g.time_class === tc && g.date >= cutoff,
      );
      if (tcGames.length < 5) return null;

      const n = tcGames.length;
      const xs = tcGames.map((_, i) => i);
      const ys = tcGames.map((g) => g.player_rating);
      const xMean = mean(xs);
      const yMean = mean(ys);
      const num = xs.reduce((sum, x, i) => sum + (x - xMean) * (ys[i] - yMean), 0);
      const den = xs.reduce((sum, x) => sum + (x - xMean) ** 2, 0);
      const slope = den !== 0 ? num / den : 0;
      const totalChange = Math.round(slope * (n - 1));

      if (Math.abs(totalChange) < 20) return null;

      const direction = totalChange > 0 ? "climbed" : "dropped";
      const first = ys[0];
      const last = ys[n - 1];
      const effectSize = Math.abs(totalChange) / first;

      return {
        detectorId: `CHESS_RATING_TREND_${tc.toUpperCase()}`,
        type: "chess_rating_trend",
        description: `Your ${tc} rating has ${direction} ${Math.abs(totalChange)} points over the last 30 days (${first} → ${last}). ${n} games analyzed.`,
        domains: ["chess"],
        data: {
          time_class: tc,
          start_rating: first,
          end_rating: last,
          total_change: totalChange,
          slope_per_game: Math.round(slope * 100) / 100,
          games: n,
        },
        significance: effectToSignificance(effectSize, { low: 0.02, mid: 0.04, high: 0.06 }),
        effectSize,
      };
    },
  });
}

// ── CHESS_TIME_OF_DAY: Best/worst time slots ─────────────────────────────────
registerDetector({
  id: "CHESS_TIME_OF_DAY",
  name: "Chess time of day performance",
  requiredDomains: ["chess"],
  category: "single",
  detect: (data: UserDataBundle) => {
    const cutoff = format(subDays(new Date(), 30), "yyyy-MM-dd");
    const recent30 = data.chessGames.filter((g) => g.date >= cutoff);
    if (recent30.length < 10) return null;

    const slots: Record<string, { label: string; min: number; max: number }> = {
      morning: { label: "before noon", min: 6, max: 12 },
      afternoon: { label: "afternoon", min: 12, max: 18 },
      evening: { label: "evening", min: 18, max: 24 },
      night: { label: "after midnight", min: 0, max: 6 },
    };

    const slotStats: Record<string, { games: ChessGame[]; wr: number }> = {};
    for (const [key, { min, max }] of Object.entries(slots)) {
      const games = recent30.filter((g) => {
        const h = parseISO(g.played_at).getHours();
        return h >= min && h < max;
      });
      slotStats[key] = { games, wr: Math.round(winRate(games) * 100) };
    }

    const validSlots = Object.entries(slotStats).filter(
      ([, v]) => v.games.length >= 3,
    );
    if (validSlots.length < 2) return null;

    const best = validSlots.reduce((a, b) => (a[1].wr > b[1].wr ? a : b));
    const worst = validSlots.reduce((a, b) => (a[1].wr < b[1].wr ? a : b));
    const delta = best[1].wr - worst[1].wr;

    if (delta < 10) return null;

    const effectSize = delta / 100;
    return {
      detectorId: "CHESS_TIME_OF_DAY",
      type: "chess_time_of_day",
      description: `You win ${best[1].wr}% of games played ${slots[best[0]].label} vs ${worst[1].wr}% ${slots[worst[0]].label}. ${recent30.length} games analyzed.`,
      domains: ["chess"],
      data: {
        best_slot: best[0],
        best_wr: best[1].wr,
        best_games: best[1].games.length,
        worst_slot: worst[0],
        worst_wr: worst[1].wr,
        worst_games: worst[1].games.length,
        delta,
      },
      significance: effectToSignificance(effectSize, { low: 0.10, mid: 0.15, high: 0.20 }),
      effectSize,
    };
  },
});

// ── CHESS_VOLUME_PERFORMANCE: Session fatigue (games 5+ worse than 1-4) ──────
registerDetector({
  id: "CHESS_VOLUME_PERFORMANCE",
  name: "Chess session volume vs performance",
  requiredDomains: ["chess"],
  category: "single",
  detect: (data: UserDataBundle) => {
    const cutoff = format(subDays(new Date(), 30), "yyyy-MM-dd");
    const recent30 = data.chessGames.filter((g) => g.date >= cutoff);
    if (recent30.length < 15) return null;

    const byDate = new Map<string, ChessGame[]>();
    for (const g of recent30) {
      const arr = byDate.get(g.date) ?? [];
      arr.push(g);
      byDate.set(g.date, arr);
    }

    const earlyGames: ChessGame[] = [];
    const lateGames: ChessGame[] = [];
    for (const games of byDate.values()) {
      const sorted = [...games].sort((a, b) =>
        a.played_at.localeCompare(b.played_at),
      );
      sorted.forEach((g, i) => {
        if (i < 4) earlyGames.push(g);
        else lateGames.push(g);
      });
    }

    if (lateGames.length < 5) return null;

    const earlyWR = Math.round(winRate(earlyGames) * 100);
    const lateWR = Math.round(winRate(lateGames) * 100);
    const earlyAcc = avgAccuracy(earlyGames);
    const lateAcc = avgAccuracy(lateGames);
    const wrDelta = earlyWR - lateWR;
    const accDelta =
      earlyAcc !== null && lateAcc !== null
        ? Math.round(earlyAcc - lateAcc)
        : null;

    if (wrDelta < 8 && (accDelta === null || accDelta < 5)) return null;

    const parts: string[] = [];
    if (wrDelta >= 5)
      parts.push(`win rate drops ${wrDelta}% (${earlyWR}% → ${lateWR}%)`);
    if (accDelta !== null && accDelta >= 3)
      parts.push(
        `accuracy drops ${accDelta}% (${Math.round(earlyAcc!)}% → ${Math.round(lateAcc!)}%)`,
      );

    const effectSize = wrDelta / 100;
    return {
      detectorId: "CHESS_VOLUME_PERFORMANCE",
      type: "chess_volume_performance",
      description: `After your 4th game in a session, ${parts.join(" and ")}. Quality over quantity — ${lateGames.length} late-session games analyzed.`,
      domains: ["chess"],
      data: {
        early_wr: earlyWR,
        late_wr: lateWR,
        wr_delta: wrDelta,
        early_accuracy: earlyAcc !== null ? Math.round(earlyAcc) : null,
        late_accuracy: lateAcc !== null ? Math.round(lateAcc) : null,
        accuracy_delta: accDelta,
        early_count: earlyGames.length,
        late_count: lateGames.length,
      },
      significance: effectToSignificance(effectSize, { low: 0.08, mid: 0.12, high: 0.18 }),
      effectSize,
    };
  },
});
