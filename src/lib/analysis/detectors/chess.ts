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

// ── RATING_VOLATILITY: Standard deviation of rating changes ─────────────────
registerDetector({
  id: "RATING_VOLATILITY",
  name: "Chess rating volatility",
  requiredDomains: ["chess"],
  category: "single",
  detect: (data: UserDataBundle) => {
    const cutoff = format(subDays(new Date(), 14), "yyyy-MM-dd");
    const recent = data.chessGames.filter((g) => g.date >= cutoff);
    if (recent.length < 10) return null;

    // Use most-played time class
    const tcCounts = new Map<string, number>();
    for (const g of recent) {
      tcCounts.set(g.time_class, (tcCounts.get(g.time_class) ?? 0) + 1);
    }
    const primaryTc = [...tcCounts.entries()].reduce((a, b) =>
      a[1] > b[1] ? a : b,
    )[0];

    const tcGames = recent.filter((g) => g.time_class === primaryTc);
    if (tcGames.length < 10) return null;

    const last30 = tcGames.slice(-30);
    const ratingChanges: number[] = [];
    for (let i = 1; i < last30.length; i++) {
      ratingChanges.push(last30[i].player_rating - last30[i - 1].player_rating);
    }

    const changeMean = mean(ratingChanges);
    const variance =
      ratingChanges.reduce((sum, c) => sum + (c - changeMean) ** 2, 0) /
      ratingChanges.length;
    const stdev = Math.round(Math.sqrt(variance));

    if (stdev < 10) return null;

    const effectSize = stdev / 100;
    return {
      detectorId: "RATING_VOLATILITY",
      type: "chess_rating_volatility",
      description: `Your ${primaryTc} rating swung ${stdev} points in the last 2 weeks. High volatility suggests inconsistent play.`,
      domains: ["chess"],
      data: {
        time_class: primaryTc,
        stdev,
        games: last30.length,
        rating_changes: ratingChanges,
        effectSize,
      },
      significance: effectToSignificance(effectSize, { low: 0.15, mid: 0.25, high: 0.40 }),
      effectSize,
    };
  },
});

// ── TIME_OF_DAY_PERFORMANCE: 3-hour granular buckets ────────────────────────
registerDetector({
  id: "TIME_OF_DAY_PERFORMANCE",
  name: "Chess granular time-of-day performance",
  requiredDomains: ["chess"],
  category: "single",
  detect: (data: UserDataBundle) => {
    const cutoff = format(subDays(new Date(), 30), "yyyy-MM-dd");
    const recent = data.chessGames.filter((g) => g.date >= cutoff);
    if (recent.length < 7) return null;

    const buckets: Record<string, { label: string; games: ChessGame[] }> = {
      "0": { label: "midnight-3am", games: [] },
      "3": { label: "3am-6am", games: [] },
      "6": { label: "6am-9am", games: [] },
      "9": { label: "9am-noon", games: [] },
      "12": { label: "noon-3pm", games: [] },
      "15": { label: "3pm-6pm", games: [] },
      "18": { label: "6pm-9pm", games: [] },
      "21": { label: "9pm-midnight", games: [] },
    };

    for (const g of recent) {
      const h = parseISO(g.played_at).getHours();
      const bucketKey = String(Math.floor(h / 3) * 3);
      buckets[bucketKey].games.push(g);
    }

    const validBuckets = Object.entries(buckets).filter(
      ([, v]) => v.games.length >= 5,
    );
    if (validBuckets.length < 2) return null;

    const bucketStats = validBuckets.map(([key, v]) => ({
      key,
      label: v.label,
      count: v.games.length,
      wr: Math.round(winRate(v.games) * 100),
    }));

    const best = bucketStats.reduce((a, b) => (a.wr > b.wr ? a : b));
    const worst = bucketStats.reduce((a, b) => (a.wr < b.wr ? a : b));
    const delta = best.wr - worst.wr;

    if (delta < 10) return null;

    const effectSize = delta / 100;
    return {
      detectorId: "TIME_OF_DAY_PERFORMANCE",
      type: "chess_time_of_day_granular",
      description: `Your win rate is ${best.wr}% between ${best.label} but drops to ${worst.wr}% after ${worst.label}.`,
      domains: ["chess"],
      data: {
        buckets: bucketStats,
        best_bucket: best.label,
        best_wr: best.wr,
        worst_bucket: worst.label,
        worst_wr: worst.wr,
        delta,
        effectSize,
      },
      significance: effectToSignificance(effectSize, { low: 0.10, mid: 0.15, high: 0.25 }),
      effectSize,
    };
  },
});

// ── WIN_STREAK_PATTERNS: Consecutive win/loss streaks ───────────────────────
registerDetector({
  id: "WIN_STREAK_PATTERNS",
  name: "Chess win/loss streak patterns",
  requiredDomains: ["chess"],
  category: "single",
  detect: (data: UserDataBundle) => {
    const cutoff = format(subDays(new Date(), 30), "yyyy-MM-dd");
    const recent = data.chessGames
      .filter((g) => g.date >= cutoff)
      .sort((a, b) => a.played_at.localeCompare(b.played_at));
    if (recent.length < 10) return null;

    let currentStreak = 0;
    let currentStreakType: "win" | "loss" | "draw" | null = null;
    let longestWin = 0;
    let longestLoss = 0;
    let tempStreak = 0;
    let tempType: string | null = null;

    for (const g of recent) {
      if (g.result === tempType) {
        tempStreak++;
      } else {
        if (tempType === "win" && tempStreak > longestWin) longestWin = tempStreak;
        if (tempType === "loss" && tempStreak > longestLoss) longestLoss = tempStreak;
        tempStreak = 1;
        tempType = g.result;
      }
    }
    // Final streak
    if (tempType === "win" && tempStreak > longestWin) longestWin = tempStreak;
    if (tempType === "loss" && tempStreak > longestLoss) longestLoss = tempStreak;
    currentStreak = tempStreak;
    currentStreakType = tempType as "win" | "loss" | "draw";

    const longestOverall = Math.max(longestWin, longestLoss);
    if (longestOverall < 3) return null;

    const effectSize = longestOverall / 10;
    const streakLabel =
      currentStreakType === "win"
        ? `${currentStreak}-game win streak`
        : currentStreakType === "loss"
          ? `${currentStreak}-game losing streak`
          : `${currentStreak}-game draw streak`;

    return {
      detectorId: "WIN_STREAK_PATTERNS",
      type: "chess_win_streak",
      description: `You're on a ${streakLabel} — your longest win streak this month is ${longestWin} games.`,
      domains: ["chess"],
      data: {
        current_streak: currentStreak,
        current_streak_type: currentStreakType,
        longest_win_streak: longestWin,
        longest_loss_streak: longestLoss,
        games: recent.length,
        effectSize,
      },
      significance: effectToSignificance(effectSize, { low: 0.3, mid: 0.5, high: 0.8 }),
      effectSize,
    };
  },
});

// ── OPENING_REPERTOIRE_DIVERSITY: Entropy of opening distribution ───────────
registerDetector({
  id: "OPENING_REPERTOIRE_DIVERSITY",
  name: "Chess opening repertoire diversity",
  requiredDomains: ["chess"],
  category: "single",
  detect: (data: UserDataBundle) => {
    const cutoff = format(subDays(new Date(), 30), "yyyy-MM-dd");
    const recent = data.chessGames.filter((g) => g.date >= cutoff);
    if (recent.length < 15) return null;

    const withOpening = recent.filter((g) => g.opening_name !== null);
    if (withOpening.length < 10) return null;

    // Count openings per color
    const colorOpenings: Record<string, Map<string, number>> = {
      white: new Map(),
      black: new Map(),
    };
    for (const g of withOpening) {
      const map = colorOpenings[g.player_color];
      const name = g.opening_name!;
      map.set(name, (map.get(name) ?? 0) + 1);
    }

    // Find the most concentrated color/opening
    let maxPct = 0;
    let topOpening = "";
    let topColor = "";
    let topCount = 0;

    for (const color of ["white", "black"] as const) {
      const map = colorOpenings[color];
      const total = [...map.values()].reduce((a, b) => a + b, 0);
      if (total < 5) continue;
      for (const [name, count] of map) {
        const pct = count / total;
        if (pct > maxPct) {
          maxPct = pct;
          topOpening = name;
          topColor = color;
          topCount = count;
        }
      }
    }

    // Calculate Shannon entropy for the dominant color
    const dominantMap = colorOpenings[topColor];
    const total = [...dominantMap.values()].reduce((a, b) => a + b, 0);
    let entropy = 0;
    for (const count of dominantMap.values()) {
      const p = count / total;
      if (p > 0) entropy -= p * Math.log2(p);
    }

    const maxEntropy = Math.log2(dominantMap.size);
    const normalizedEntropy = maxEntropy > 0 ? entropy / maxEntropy : 1;

    // Low entropy = concentrated repertoire
    if (maxPct < 0.3) return null;

    const effectSize = maxPct;
    return {
      detectorId: "OPENING_REPERTOIRE_DIVERSITY",
      type: "chess_opening_diversity",
      description: `You play the ${topOpening} in ${Math.round(maxPct * 100)}% of your games as ${topColor}. Consider diversifying.`,
      domains: ["chess"],
      data: {
        top_opening: topOpening,
        top_color: topColor,
        top_pct: Math.round(maxPct * 100),
        top_count: topCount,
        unique_openings: dominantMap.size,
        entropy: Math.round(entropy * 100) / 100,
        normalized_entropy: Math.round(normalizedEntropy * 100) / 100,
        effectSize,
      },
      significance: effectToSignificance(effectSize, { low: 0.30, mid: 0.50, high: 0.70 }),
      effectSize,
    };
  },
});

// ── BLITZ_VS_RAPID_RATING_GAP: Compare ratings across time controls ────────
registerDetector({
  id: "BLITZ_VS_RAPID_RATING_GAP",
  name: "Chess blitz vs rapid rating gap",
  requiredDomains: ["chess"],
  category: "single",
  detect: (data: UserDataBundle) => {
    const cutoff = format(subDays(new Date(), 30), "yyyy-MM-dd");
    const recent = data.chessGames.filter((g) => g.date >= cutoff);

    const blitzGames = recent.filter((g) => g.time_class === "blitz");
    const rapidGames = recent.filter((g) => g.time_class === "rapid");

    if (blitzGames.length < 5 || rapidGames.length < 5) return null;

    // Use latest game rating for each
    const latestBlitz = blitzGames.reduce((a, b) =>
      a.played_at > b.played_at ? a : b,
    );
    const latestRapid = rapidGames.reduce((a, b) =>
      a.played_at > b.played_at ? a : b,
    );

    const blitzRating = latestBlitz.player_rating;
    const rapidRating = latestRapid.player_rating;
    const gap = rapidRating - blitzRating;

    if (Math.abs(gap) < 50) return null;

    const higher = gap > 0 ? "rapid" : "blitz";
    const effectSize = Math.abs(gap) / 1000;

    return {
      detectorId: "BLITZ_VS_RAPID_RATING_GAP",
      type: "chess_rating_gap",
      description: `Your rapid rating is ${Math.abs(gap)} points ${gap > 0 ? "higher" : "lower"} than blitz. ${gap > 0 ? "Time pressure may be hurting your play." : "You thrive under time pressure."}`,
      domains: ["chess"],
      data: {
        blitz_rating: blitzRating,
        rapid_rating: rapidRating,
        gap,
        higher_tc: higher,
        blitz_games: blitzGames.length,
        rapid_games: rapidGames.length,
        effectSize,
      },
      significance: effectToSignificance(effectSize, { low: 0.05, mid: 0.15, high: 0.25 }),
      effectSize,
    };
  },
});

// ── TILT_DETECTION: Revenge games after losses ──────────────────────────────
registerDetector({
  id: "TILT_DETECTION",
  name: "Chess tilt / revenge game detection",
  requiredDomains: ["chess"],
  category: "single",
  detect: (data: UserDataBundle) => {
    const cutoff = format(subDays(new Date(), 30), "yyyy-MM-dd");
    const recent = data.chessGames
      .filter((g) => g.date >= cutoff)
      .sort((a, b) => a.played_at.localeCompare(b.played_at));
    if (recent.length < 7) return null;

    let lossCount = 0;
    let revengeCount = 0;
    let revengeWins = 0;

    for (let i = 0; i < recent.length - 1; i++) {
      if (recent[i].result !== "loss") continue;
      lossCount++;

      const t1 = parseISO(recent[i].played_at).getTime();
      const t2 = parseISO(recent[i + 1].played_at).getTime();
      const gapSeconds = (t2 - t1) / 1000;

      if (gapSeconds < 60) {
        revengeCount++;
        if (recent[i + 1].result === "win") revengeWins++;
      }
    }

    if (lossCount < 5 || revengeCount < 3) return null;

    const tiltPct = Math.round((revengeCount / lossCount) * 100);
    const revengeWR = Math.round((revengeWins / revengeCount) * 100);

    const effectSize = tiltPct / 100;
    return {
      detectorId: "TILT_DETECTION",
      type: "chess_tilt",
      description: `After losses, you queue another game within 60 seconds ${tiltPct}% of the time. Your win rate in revenge games is only ${revengeWR}%.`,
      domains: ["chess"],
      data: {
        total_losses: lossCount,
        revenge_games: revengeCount,
        revenge_wins: revengeWins,
        tilt_pct: tiltPct,
        revenge_win_rate: revengeWR,
        effectSize,
      },
      significance: effectToSignificance(effectSize, { low: 0.20, mid: 0.35, high: 0.50 }),
      effectSize,
    };
  },
});

// ── GAME_LENGTH_PREFERENCE: Average moves per game ──────────────────────────
registerDetector({
  id: "GAME_LENGTH_PREFERENCE",
  name: "Chess game length preference",
  requiredDomains: ["chess"],
  category: "single",
  detect: (data: UserDataBundle) => {
    const cutoff = format(subDays(new Date(), 30), "yyyy-MM-dd");
    const recent = data.chessGames.filter(
      (g) => g.date >= cutoff && g.num_moves !== null,
    );
    if (recent.length < 7) return null;

    const moves = recent.map((g) => g.num_moves!);
    const avg = Math.round(mean(moves));

    // Classify: short tactical (<25), medium (25-40), long strategic (>40)
    const style =
      avg < 25
        ? "quick tactical battles"
        : avg > 40
          ? "long strategic grinds"
          : "medium-length games";

    const shortGames = moves.filter((m) => m < 25).length;
    const longGames = moves.filter((m) => m > 40).length;

    // Effect size based on deviation from "average" game length (~30 moves)
    const effectSize = Math.abs(avg - 30) / 30;

    if (effectSize < 0.05) return null;

    return {
      detectorId: "GAME_LENGTH_PREFERENCE",
      type: "chess_game_length",
      description: `Your games average ${avg} moves — you prefer ${style} over ${avg < 30 ? "long strategic grinds" : "quick tactical battles"}.`,
      domains: ["chess"],
      data: {
        avg_moves: avg,
        short_games: shortGames,
        long_games: longGames,
        total_games: recent.length,
        style,
        effectSize,
      },
      significance: effectToSignificance(effectSize, { low: 0.10, mid: 0.25, high: 0.40 }),
      effectSize,
    };
  },
});

// ── ACCURACY_TREND: Linear regression of accuracy over recent games ─────────
registerDetector({
  id: "ACCURACY_TREND",
  name: "Chess accuracy trend",
  requiredDomains: ["chess"],
  category: "single",
  detect: (data: UserDataBundle) => {
    const cutoff = format(subDays(new Date(), 30), "yyyy-MM-dd");
    const recent = data.chessGames
      .filter((g) => g.date >= cutoff && g.accuracy !== null)
      .sort((a, b) => a.played_at.localeCompare(b.played_at));
    if (recent.length < 10) return null;

    const last30 = recent.slice(-30);
    const xs = last30.map((_, i) => i);
    const ys = last30.map((g) => g.accuracy!);
    const xMean = mean(xs);
    const yMean = mean(ys);
    const num = xs.reduce((sum, x, i) => sum + (x - xMean) * (ys[i] - yMean), 0);
    const den = xs.reduce((sum, x) => sum + (x - xMean) ** 2, 0);
    const slope = den !== 0 ? num / den : 0;

    const n = last30.length;
    const startAcc = Math.round(ys[0]);
    const endAcc = Math.round(ys[n - 1]);
    const predictedStart = Math.round(yMean + slope * (0 - xMean));
    const predictedEnd = Math.round(yMean + slope * (n - 1 - xMean));
    const totalChange = predictedEnd - predictedStart;

    if (Math.abs(totalChange) < 2) return null;

    const direction = totalChange > 0 ? "improved" : "declined";
    const effectSize = Math.abs(totalChange) / 100;

    return {
      detectorId: "ACCURACY_TREND",
      type: "chess_accuracy_trend",
      description: `Your average accuracy has ${direction} from ${predictedStart}% to ${predictedEnd}% over the last month.`,
      domains: ["chess"],
      data: {
        start_accuracy: predictedStart,
        end_accuracy: predictedEnd,
        total_change: totalChange,
        slope_per_game: Math.round(slope * 100) / 100,
        games_with_accuracy: n,
        raw_start: startAcc,
        raw_end: endAcc,
        effectSize,
      },
      significance: effectToSignificance(effectSize, { low: 0.02, mid: 0.05, high: 0.08 }),
      effectSize,
    };
  },
});
