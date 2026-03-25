import { format, parseISO, subDays } from "date-fns";
import { registerDetector } from "../detector-registry";
import type { UserDataBundle } from "../data-bundle";
import { mean, winRate, avgAccuracy, effectToSignificance } from "./utils";

// ── CHESS_MOOD_CORRELATION: Mood → chess win rate ────────────────────────────
registerDetector({
  id: "CHESS_MOOD_CORRELATION",
  name: "Mood vs chess performance",
  requiredDomains: ["chess", "wellbeing"],
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
      domains: ["chess", "wellbeing"],
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
  requiredDomains: ["chess", "wellbeing"],
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
      domains: ["chess", "wellbeing"],
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
  requiredDomains: ["chess", "wellbeing"],
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
      domains: ["chess", "wellbeing"],
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

// ── CHESS_LOSSES_VS_NEXT_DAY_MOOD: Heavy losses → next-day mood ─────────────
registerDetector({
  id: "CHESS_LOSSES_VS_NEXT_DAY_MOOD",
  name: "Chess losses vs next-day mood",
  requiredDomains: ["chess", "wellbeing"],
  category: "cross",
  detect: (data: UserDataBundle) => {
    const heavyLossDayMoods: number[] = [];
    const lightDayMoods: number[] = [];

    for (const [date, games] of data.chessByDate) {
      const losses = games.filter((g) => g.result === "loss").length;
      const nextDay = format(subDays(new Date(date), -1), "yyyy-MM-dd");
      const nextCheckin = data.checkinByDate.get(nextDay);
      if (!nextCheckin) continue;

      if (losses >= 3) {
        heavyLossDayMoods.push(nextCheckin.mood);
      } else if (losses <= 1) {
        lightDayMoods.push(nextCheckin.mood);
      }
    }

    if (heavyLossDayMoods.length < 7 || lightDayMoods.length < 7) return null;

    const heavyMean = mean(heavyLossDayMoods);
    const lightMean = mean(lightDayMoods);
    const delta = lightMean - heavyMean;

    if (Math.abs(delta) < 0.5) return null;

    const effectSize = Math.abs(delta) / 10;
    return {
      detectorId: "CHESS_LOSSES_VS_NEXT_DAY_MOOD",
      type: "chess_losses_next_day_mood",
      description: `After losing 3+ chess games, your next-day mood averages ${heavyMean.toFixed(1)} vs ${lightMean.toFixed(1)} after winning sessions.`,
      domains: ["chess", "wellbeing"],
      data: {
        heavy_loss_next_mood: Math.round(heavyMean * 10) / 10,
        light_day_next_mood: Math.round(lightMean * 10) / 10,
        mood_delta: Math.round(delta * 10) / 10,
        heavy_loss_days: heavyLossDayMoods.length,
        light_days: lightDayMoods.length,
      },
      significance: effectToSignificance(effectSize, { low: 0.05, mid: 0.10, high: 0.20 }),
      effectSize,
    };
  },
});

// ── MOOD_VS_CHESS_RISK_TAKING: Mood → opening style ─────────────────────────
registerDetector({
  id: "MOOD_VS_CHESS_RISK_TAKING",
  name: "Mood vs chess risk-taking",
  requiredDomains: ["chess", "wellbeing"],
  category: "cross",
  detect: (data: UserDataBundle) => {
    const aggressivePatterns = ["Gambit", "King's Indian", "Sicilian", "Dutch", "Grünfeld"];
    const solidPatterns = ["London", "Italian", "Queen's Gambit Declined", "Caro-Kann", "French", "Petroff"];

    const classify = (name: string | null): "aggressive" | "solid" | "unknown" => {
      if (!name) return "unknown";
      if (aggressivePatterns.some((p) => name.includes(p))) return "aggressive";
      if (solidPatterns.some((p) => name.includes(p))) return "solid";
      return "unknown";
    };

    const highMoodGames: { style: "aggressive" | "solid" | "unknown" }[] = [];
    const lowMoodGames: { style: "aggressive" | "solid" | "unknown" }[] = [];

    for (const game of data.chessGames) {
      const ci = data.checkinByDate.get(game.date);
      if (!ci) continue;
      const style = classify(game.opening_name);
      if (style === "unknown") continue;

      if (ci.mood >= 7) {
        highMoodGames.push({ style });
      } else if (ci.mood < 5) {
        lowMoodGames.push({ style });
      }
    }

    if (highMoodGames.length < 7 || lowMoodGames.length < 7) return null;

    const highAggPct = Math.round(
      (highMoodGames.filter((g) => g.style === "aggressive").length / highMoodGames.length) * 100,
    );
    const lowAggPct = Math.round(
      (lowMoodGames.filter((g) => g.style === "aggressive").length / lowMoodGames.length) * 100,
    );
    const delta = highAggPct - lowAggPct;

    if (Math.abs(delta) < 10) return null;

    const effectSize = Math.abs(delta) / 100;
    return {
      detectorId: "MOOD_VS_CHESS_RISK_TAKING",
      type: "mood_chess_risk_taking",
      description: `When your mood is above 7, you play aggressive openings ${highAggPct}% of the time.`,
      domains: ["chess", "wellbeing"],
      data: {
        high_mood_aggressive_pct: highAggPct,
        low_mood_aggressive_pct: lowAggPct,
        aggressive_delta: delta,
        high_mood_classified_games: highMoodGames.length,
        low_mood_classified_games: lowMoodGames.length,
      },
      significance: effectToSignificance(effectSize, { low: 0.10, mid: 0.20, high: 0.35 }),
      effectSize,
    };
  },
});

// ── STRESS_VS_CHESS_TILT: Stress → revenge game frequency ───────────────────
registerDetector({
  id: "STRESS_VS_CHESS_TILT",
  name: "Stress vs chess tilt",
  requiredDomains: ["chess", "wellbeing"],
  category: "cross",
  detect: (data: UserDataBundle) => {
    let highStressGames = 0;
    let highStressRevenge = 0;
    let lowStressGames = 0;
    let lowStressRevenge = 0;

    for (const [date, games] of data.chessByDate) {
      const ci = data.checkinByDate.get(date);
      if (!ci) continue;

      const sorted = [...games].sort(
        (a, b) => parseISO(a.played_at).getTime() - parseISO(b.played_at).getTime(),
      );

      for (let i = 1; i < sorted.length; i++) {
        const prev = sorted[i - 1];
        const curr = sorted[i];
        const gap =
          (parseISO(curr.played_at).getTime() - parseISO(prev.played_at).getTime()) / 1000;
        const isRevenge = prev.result === "loss" && gap < 60;

        if (ci.stress >= 7) {
          highStressGames++;
          if (isRevenge) highStressRevenge++;
        } else if (ci.stress < 4) {
          lowStressGames++;
          if (isRevenge) lowStressRevenge++;
        }
      }
    }

    if (highStressGames < 7 || lowStressGames < 7) return null;

    const highRevengeRate = highStressRevenge / highStressGames;
    const lowRevengeRate = lowStressRevenge / lowStressGames;

    if (lowRevengeRate === 0 && highRevengeRate === 0) return null;

    const ratio = lowRevengeRate > 0 ? highRevengeRate / lowRevengeRate : highRevengeRate > 0 ? Infinity : 1;

    if (ratio < 1.5) return null;

    const effectSize = Math.min(1, (ratio - 1) / 5);
    const ratioLabel = ratio === Infinity ? "far" : `${ratio.toFixed(1)}x`;
    return {
      detectorId: "STRESS_VS_CHESS_TILT",
      type: "stress_chess_tilt",
      description: `On high-stress days, you play revenge games ${ratioLabel} more often.`,
      domains: ["chess", "wellbeing"],
      data: {
        high_stress_revenge_rate: Math.round(highRevengeRate * 100),
        low_stress_revenge_rate: Math.round(lowRevengeRate * 100),
        revenge_ratio: ratio === Infinity ? null : Math.round(ratio * 10) / 10,
        high_stress_games: highStressGames,
        low_stress_games: lowStressGames,
      },
      significance: effectToSignificance(effectSize, { low: 0.10, mid: 0.25, high: 0.40 }),
      effectSize,
    };
  },
});
