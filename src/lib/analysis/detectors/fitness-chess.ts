import { format, subDays } from "date-fns";
import { registerDetector } from "../detector-registry";
import type { UserDataBundle } from "../data-bundle";
import { winRate, effectToSignificance } from "./utils";

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
