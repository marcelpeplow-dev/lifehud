import { format, subDays } from "date-fns";
import { registerDetector } from "../detector-registry";
import type { UserDataBundle } from "../data-bundle";
import { mean, winRate, avgAccuracy, effectToSignificance } from "./utils";

// ── CHESS_MOOD_CORRELATION: Mood → chess win rate ────────────────────────────
registerDetector({
  id: "CHESS_MOOD_CORRELATION",
  name: "Mood vs chess performance",
  requiredDomains: ["chess", "mood"],
  category: "cross",
  detect: (data: UserDataBundle) => {
    if (data.checkins.length < 5) return null;

    const cutoff = format(subDays(new Date(), 30), "yyyy-MM-dd");
    const recent30 = data.chessGames.filter((g) => g.date >= cutoff);

    const highMoodGames = recent30.filter((g) => {
      const ci = data.checkinByDate.get(g.date);
      return ci && ci.mood > 7;
    });
    const lowMoodGames = recent30.filter((g) => {
      const ci = data.checkinByDate.get(g.date);
      return ci && ci.mood < 5;
    });

    if (highMoodGames.length < 3 || lowMoodGames.length < 3) return null;

    const highWR = Math.round(winRate(highMoodGames) * 100);
    const lowWR = Math.round(winRate(lowMoodGames) * 100);
    const wrDelta = highWR - lowWR;

    if (Math.abs(wrDelta) < 8) return null;

    const effectSize = Math.abs(wrDelta) / 100;
    return {
      detectorId: "CHESS_MOOD_CORRELATION",
      type: "chess_mood_correlation",
      description: `When your mood is above 7, your chess win rate is ${highWR}% vs ${lowWR}% when mood is below 5 — a ${Math.abs(wrDelta)}% difference. ${highMoodGames.length + lowMoodGames.length} games analyzed.`,
      domains: ["chess", "mood"],
      data: {
        high_mood_wr: highWR,
        low_mood_wr: lowWR,
        wr_delta: wrDelta,
        high_mood_games: highMoodGames.length,
        low_mood_games: lowMoodGames.length,
      },
      significance: effectToSignificance(effectSize, { low: 0.08, mid: 0.12, high: 0.18 }),
      effectSize,
    };
  },
});

// ── CHESS_STRESS_CORRELATION: Stress → chess performance ─────────────────────
registerDetector({
  id: "CHESS_STRESS_CORRELATION",
  name: "Stress vs chess performance",
  requiredDomains: ["chess", "mood"],
  category: "cross",
  detect: (data: UserDataBundle) => {
    if (data.checkins.length < 5) return null;

    const cutoff = format(subDays(new Date(), 30), "yyyy-MM-dd");
    const recent30 = data.chessGames.filter((g) => g.date >= cutoff);

    const highStressGames = recent30.filter((g) => {
      const ci = data.checkinByDate.get(g.date);
      return ci && ci.stress > 7;
    });
    const lowStressGames = recent30.filter((g) => {
      const ci = data.checkinByDate.get(g.date);
      return ci && ci.stress < 4;
    });

    if (highStressGames.length < 3 || lowStressGames.length < 3) return null;

    const highWR = Math.round(winRate(highStressGames) * 100);
    const lowWR = Math.round(winRate(lowStressGames) * 100);
    const wrDelta = lowWR - highWR; // positive = low stress is better

    const highAvgRating = Math.round(
      mean(highStressGames.map((g) => g.player_rating)),
    );
    const lowAvgRating = Math.round(
      mean(lowStressGames.map((g) => g.player_rating)),
    );
    const ratingDelta = lowAvgRating - highAvgRating;

    if (Math.abs(wrDelta) < 8 && Math.abs(ratingDelta) < 20) return null;

    const parts: string[] = [];
    if (Math.abs(wrDelta) >= 5)
      parts.push(
        `win rate ${wrDelta > 0 ? "jumps to" : "drops to"} ${lowWR}% vs ${highWR}% on high-stress days`,
      );
    if (Math.abs(ratingDelta) >= 15)
      parts.push(
        `average rating is ${Math.abs(ratingDelta)} points ${ratingDelta > 0 ? "higher" : "lower"} when calm`,
      );

    const effectSize = Math.max(
      Math.abs(wrDelta) / 100,
      Math.abs(ratingDelta) / highAvgRating,
    );
    return {
      detectorId: "CHESS_STRESS_CORRELATION",
      type: "chess_stress_correlation",
      description: `When stress is low (<4), ${parts.join(" and ")}. ${highStressGames.length + lowStressGames.length} games analyzed.`,
      domains: ["chess", "mood"],
      data: {
        high_stress_wr: highWR,
        low_stress_wr: lowWR,
        wr_delta: wrDelta,
        high_stress_avg_rating: highAvgRating,
        low_stress_avg_rating: lowAvgRating,
        rating_delta: ratingDelta,
        high_stress_games: highStressGames.length,
        low_stress_games: lowStressGames.length,
      },
      significance: effectToSignificance(effectSize, { low: 0.08, mid: 0.15, high: 0.25 }),
      effectSize,
    };
  },
});

// ── CHESS_ENERGY_CORRELATION: Energy → chess accuracy/win rate ────────────────
registerDetector({
  id: "CHESS_ENERGY_CORRELATION",
  name: "Energy vs chess performance",
  requiredDomains: ["chess", "mood"],
  category: "cross",
  detect: (data: UserDataBundle) => {
    if (data.checkins.length < 5) return null;

    const cutoff = format(subDays(new Date(), 30), "yyyy-MM-dd");
    const recent30 = data.chessGames.filter((g) => g.date >= cutoff);

    const highEnergyGames = recent30.filter((g) => {
      const ci = data.checkinByDate.get(g.date);
      return ci && ci.energy > 7;
    });
    const lowEnergyGames = recent30.filter((g) => {
      const ci = data.checkinByDate.get(g.date);
      return ci && ci.energy < 5;
    });

    if (highEnergyGames.length < 3 || lowEnergyGames.length < 3) return null;

    const highAcc = avgAccuracy(highEnergyGames);
    const lowAcc = avgAccuracy(lowEnergyGames);
    const highWR = Math.round(winRate(highEnergyGames) * 100);
    const lowWR = Math.round(winRate(lowEnergyGames) * 100);
    const wrDelta = highWR - lowWR;
    const accDelta =
      highAcc !== null && lowAcc !== null
        ? Math.round(highAcc - lowAcc)
        : null;

    if (
      Math.abs(wrDelta) < 8 &&
      (accDelta === null || Math.abs(accDelta) < 5)
    )
      return null;

    const parts: string[] = [];
    if (accDelta !== null && Math.abs(accDelta) >= 3)
      parts.push(
        `accuracy is ${Math.abs(accDelta)}% ${accDelta > 0 ? "higher" : "lower"} (${Math.round(highAcc!)}% vs ${Math.round(lowAcc!)}%)`,
      );
    if (Math.abs(wrDelta) >= 5)
      parts.push(
        `win rate is ${Math.abs(wrDelta)}% ${wrDelta > 0 ? "higher" : "lower"} (${highWR}% vs ${lowWR}%)`,
      );

    const effectSize = Math.max(
      Math.abs(wrDelta) / 100,
      accDelta !== null ? Math.abs(accDelta) / 100 : 0,
    );
    return {
      detectorId: "CHESS_ENERGY_CORRELATION",
      type: "chess_energy_correlation",
      description: `When energy is above 7, your chess ${parts.join(" and ")} compared to low-energy days (<5). ${highEnergyGames.length + lowEnergyGames.length} games analyzed.`,
      domains: ["chess", "mood"],
      data: {
        high_energy_wr: highWR,
        low_energy_wr: lowWR,
        wr_delta: wrDelta,
        high_energy_accuracy: highAcc !== null ? Math.round(highAcc) : null,
        low_energy_accuracy: lowAcc !== null ? Math.round(lowAcc) : null,
        accuracy_delta: accDelta,
        high_energy_games: highEnergyGames.length,
        low_energy_games: lowEnergyGames.length,
      },
      significance: effectToSignificance(effectSize, { low: 0.08, mid: 0.12, high: 0.18 }),
      effectSize,
    };
  },
});
