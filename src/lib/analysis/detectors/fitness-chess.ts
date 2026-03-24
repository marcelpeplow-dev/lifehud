import { format, subDays, parseISO } from "date-fns";
import { registerDetector } from "../detector-registry";
import type { UserDataBundle } from "../data-bundle";
import { winRate, effectToSignificance, mean, avgAccuracy } from "./utils";

// ── CHESS_EXERCISE_CORRELATION: Workout days → chess performance ─────────────
registerDetector({
  id: "CHESS_EXERCISE_CORRELATION",
  name: "Exercise vs chess performance",
  requiredDomains: ["chess", "fitness"],
  category: "cross",
  detect: (data: UserDataBundle) => {
    const cutoff = format(subDays(new Date(), 30), "yyyy-MM-dd");
    const recent30 = data.chessGames.filter((g) => g.date >= cutoff);

    const workoutDates = new Set(data.workouts.map((w) => w.date));
    const onWorkoutDays = recent30.filter((g) => workoutDates.has(g.date));
    const onRestDays = recent30.filter((g) => !workoutDates.has(g.date));

    if (onWorkoutDays.length < 3 || onRestDays.length < 3) return null;

    const workoutWR = Math.round(winRate(onWorkoutDays) * 100);
    const restWR = Math.round(winRate(onRestDays) * 100);
    const wrDelta = workoutWR - restWR;

    if (Math.abs(wrDelta) < 8) return null;

    const effectSize = Math.abs(wrDelta) / 100;
    return {
      detectorId: "CHESS_EXERCISE_CORRELATION",
      type: "chess_exercise_correlation",
      description: `On workout days, your chess win rate is ${workoutWR}% vs ${restWR}% on rest days — a ${Math.abs(wrDelta)}% ${wrDelta > 0 ? "boost" : "drop"}. ${onWorkoutDays.length + onRestDays.length} games analyzed.`,
      domains: ["chess", "fitness"],
      data: {
        workout_wr: workoutWR,
        rest_wr: restWR,
        wr_delta: wrDelta,
        workout_games: onWorkoutDays.length,
        rest_games: onRestDays.length,
      },
      significance: effectToSignificance(effectSize, { low: 0.08, mid: 0.12, high: 0.18 }),
      effectSize,
    };
  },
});

// ── WORKOUT_DAY_VS_CHESS_PERFORMANCE: Accuracy + win rate on workout vs rest days
registerDetector({
  id: "WORKOUT_DAY_VS_CHESS_PERFORMANCE",
  name: "Workout days vs chess accuracy & win rate",
  requiredDomains: ["chess", "fitness"],
  category: "cross",
  detect: (data: UserDataBundle) => {
    const cutoff = format(subDays(new Date(), 30), "yyyy-MM-dd");
    const workoutDates = new Set(data.workouts.map((w) => w.date));

    const workoutDayGames: typeof data.chessGames = [];
    const restDayGames: typeof data.chessGames = [];

    for (const [date, games] of data.chessByDate) {
      if (date < cutoff) continue;
      if (workoutDates.has(date)) {
        workoutDayGames.push(...games);
      } else {
        restDayGames.push(...games);
      }
    }

    if (workoutDayGames.length < 7 || restDayGames.length < 7) return null;

    const workoutAcc = avgAccuracy(workoutDayGames);
    const restAcc = avgAccuracy(restDayGames);
    const workoutWR = Math.round(winRate(workoutDayGames) * 100);
    const restWR = Math.round(winRate(restDayGames) * 100);

    const accDelta = workoutAcc !== null && restAcc !== null
      ? Math.round(workoutAcc - restAcc)
      : null;
    const wrDelta = workoutWR - restWR;

    // Need at least one meaningful difference
    if (accDelta !== null && Math.abs(accDelta) < 2 && Math.abs(wrDelta) < 5) return null;
    if (accDelta === null && Math.abs(wrDelta) < 8) return null;

    const avgWorkoutRating = Math.round(
      mean(workoutDayGames.map((g) => g.player_rating)),
    );
    const avgRestRating = Math.round(
      mean(restDayGames.map((g) => g.player_rating)),
    );

    const parts: string[] = [];
    parts.push(
      `Your blitz rating averages ${avgWorkoutRating.toLocaleString()} on workout days vs ${avgRestRating.toLocaleString()} on rest days.`,
    );
    if (accDelta !== null) {
      parts.push(
        `Accuracy is ${Math.round(workoutAcc!)}% vs ${Math.round(restAcc!)}% (${accDelta > 0 ? "+" : ""}${accDelta}%).`,
      );
    }
    parts.push(
      `Win rate: ${workoutWR}% vs ${restWR}% (${wrDelta > 0 ? "+" : ""}${wrDelta}%).`,
    );

    const effectSize = Math.max(
      Math.abs(wrDelta) / 100,
      accDelta !== null ? Math.abs(accDelta) / 100 : 0,
    );

    return {
      detectorId: "WORKOUT_DAY_VS_CHESS_PERFORMANCE",
      type: "workout_day_vs_chess_performance",
      description: parts.join(" "),
      domains: ["chess", "fitness"],
      data: {
        workout_accuracy: workoutAcc !== null ? Math.round(workoutAcc) : null,
        rest_accuracy: restAcc !== null ? Math.round(restAcc) : null,
        accuracy_delta: accDelta,
        workout_wr: workoutWR,
        rest_wr: restWR,
        wr_delta: wrDelta,
        avg_workout_rating: avgWorkoutRating,
        avg_rest_rating: avgRestRating,
        workout_games: workoutDayGames.length,
        rest_games: restDayGames.length,
      },
      significance: effectToSignificance(effectSize, { low: 0.05, mid: 0.10, high: 0.18 }),
      effectSize,
    };
  },
});

// ── POST_WORKOUT_CHESS_TIMING: Best chess accuracy by hours after workout ─────
registerDetector({
  id: "POST_WORKOUT_CHESS_TIMING",
  name: "Post-workout chess timing",
  requiredDomains: ["chess", "fitness"],
  category: "cross",
  detect: (data: UserDataBundle) => {
    const cutoff = format(subDays(new Date(), 30), "yyyy-MM-dd");

    // Build a list of workout end timestamps
    const workoutEnds: { date: string; endMs: number }[] = [];
    for (const w of data.workouts) {
      if (w.date < cutoff) continue;
      let endMs: number | null = null;
      if (w.ended_at) {
        endMs = parseISO(w.ended_at).getTime();
      } else if (w.started_at && w.duration_minutes) {
        endMs = parseISO(w.started_at).getTime() + w.duration_minutes * 60_000;
      }
      if (endMs !== null) {
        workoutEnds.push({ date: w.date, endMs });
      }
    }

    if (workoutEnds.length === 0) return null;

    // Bucket chess games by hours after the most recent prior workout
    const buckets: { label: string; min: number; max: number; games: typeof data.chessGames }[] = [
      { label: "0-2h", min: 0, max: 2, games: [] },
      { label: "2-5h", min: 2, max: 5, games: [] },
      { label: "5h+", min: 5, max: Infinity, games: [] },
    ];

    for (const [date, games] of data.chessByDate) {
      if (date < cutoff) continue;
      for (const game of games) {
        if (!game.played_at) continue;
        const gameMs = parseISO(game.played_at).getTime();

        // Find the closest prior workout end on the same day
        let bestHours: number | null = null;
        for (const we of workoutEnds) {
          if (we.date !== date) continue;
          const diffHours = (gameMs - we.endMs) / 3_600_000;
          if (diffHours < 0) continue; // game was before workout ended
          if (bestHours === null || diffHours < bestHours) {
            bestHours = diffHours;
          }
        }

        if (bestHours === null) continue;

        for (const bucket of buckets) {
          if (bestHours >= bucket.min && bestHours < bucket.max) {
            bucket.games.push(game);
            break;
          }
        }
      }
    }

    const totalGames = buckets.reduce((s, b) => s + b.games.length, 0);
    if (totalGames < 7) return null;

    const bucketStats = buckets
      .filter((b) => b.games.length > 0)
      .map((b) => ({
        label: b.label,
        count: b.games.length,
        accuracy: avgAccuracy(b.games),
        wr: Math.round(winRate(b.games) * 100),
      }));

    if (bucketStats.length < 2) return null;

    // Find the best bucket by accuracy (fall back to win rate)
    const withAcc = bucketStats.filter((b) => b.accuracy !== null);
    let bestBucket: (typeof bucketStats)[number];
    if (withAcc.length >= 2) {
      bestBucket = withAcc.reduce((a, b) => (b.accuracy! > a.accuracy! ? b : a));
    } else {
      bestBucket = bucketStats.reduce((a, b) => (b.wr > a.wr ? b : a));
    }

    const worstBucket = withAcc.length >= 2
      ? withAcc.reduce((a, b) => (b.accuracy! < a.accuracy! ? b : a))
      : bucketStats.reduce((a, b) => (b.wr < a.wr ? b : a));

    // Build description
    const timingMap: Record<string, string> = {
      "0-2h": "immediately post-workout",
      "2-5h": "2\u20135 hours after a workout",
      "5h+": "5+ hours after a workout",
    };

    const bestDesc = timingMap[bestBucket.label] ?? bestBucket.label;
    const worstDesc = timingMap[worstBucket.label] ?? worstBucket.label;

    const parts: string[] = [];
    parts.push(`Your best chess happens ${bestDesc}.`);
    if (bestBucket.label !== worstBucket.label) {
      parts.push(`Games ${worstDesc} show lower accuracy.`);
    }

    const accRange = withAcc.length >= 2
      ? Math.abs((bestBucket.accuracy ?? 0) - (worstBucket.accuracy ?? 0))
      : 0;
    const wrRange = Math.abs(bestBucket.wr - worstBucket.wr);
    const effectSize = Math.max(accRange / 100, wrRange / 100);

    return {
      detectorId: "POST_WORKOUT_CHESS_TIMING",
      type: "post_workout_chess_timing",
      description: parts.join(" "),
      domains: ["chess", "fitness"],
      data: {
        buckets: bucketStats.map((b) => ({
          label: b.label,
          games: b.count,
          accuracy: b.accuracy !== null ? Math.round(b.accuracy) : null,
          win_rate: b.wr,
        })),
        best_bucket: bestBucket.label,
        total_games: totalGames,
      },
      significance: effectToSignificance(effectSize, { low: 0.04, mid: 0.08, high: 0.15 }),
      effectSize,
    };
  },
});
