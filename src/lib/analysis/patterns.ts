import { format, subDays, parseISO } from "date-fns";
import type { SleepRecord, Workout, DailyMetrics, CheckIn, ChessGame, DetectedPattern } from "@/types/index";

function halfTrend(values: number[]): "up" | "down" | "flat" {
  if (values.length < 4) return "flat";
  const mid = Math.floor(values.length / 2);
  const first = mean(values.slice(0, mid));
  const second = mean(values.slice(mid));
  const pct = first === 0 ? 0 : Math.abs((second - first) / first);
  if (pct < 0.03) return "flat";
  return second > first ? "up" : "down";
}

function mean(values: number[]): number {
  if (!values.length) return 0;
  return values.reduce((a, b) => a + b, 0) / values.length;
}

export interface PatternInput {
  sleepRecords: SleepRecord[];
  workouts: Workout[];
  dailyMetrics: DailyMetrics[];
  checkIns: CheckIn[];
  chessGames: ChessGame[];
  today: Date;
}

export function detectPatterns({ sleepRecords, workouts, checkIns, chessGames }: PatternInput): DetectedPattern[] {
  const patterns: DetectedPattern[] = [];

  // ── 1. Sleep duration → next-day workout intensity ───────────────────────
  const workoutsWithSleep = workouts
    .map((w) => {
      const prevNight = sleepRecords.find(
        (s) => s.date === format(subDays(new Date(w.date), 1), "yyyy-MM-dd")
      );
      return prevNight ? { sleep: prevNight.duration_minutes, intensity: w.intensity_score } : null;
    })
    .filter((x): x is { sleep: number; intensity: number } =>
      x !== null && x.sleep != null && x.intensity != null
    );

  if (workoutsWithSleep.length >= 5) {
    const goodSleep = workoutsWithSleep.filter((x) => x.sleep >= 420);
    const poorSleep = workoutsWithSleep.filter((x) => x.sleep < 420);
    if (goodSleep.length >= 2 && poorSleep.length >= 2) {
      const goodAvg = Math.round(mean(goodSleep.map((x) => x.intensity)));
      const poorAvg = Math.round(mean(poorSleep.map((x) => x.intensity)));
      const delta = goodAvg - poorAvg;
      if (Math.abs(delta) >= 8) {
        patterns.push({
          type: "sleep_performance_correlation",
          description: `Workout intensity is ${Math.abs(delta)} points ${delta > 0 ? "higher" : "lower"} after 7h+ sleep vs under 7h (avg ${goodAvg} vs ${poorAvg}). ${workoutsWithSleep.length} workouts analyzed.`,
          data: {
            well_rested_avg: goodAvg,
            fatigued_avg: poorAvg,
            delta,
            sample_size: workoutsWithSleep.length,
            good_sleep_sample: goodSleep.length,
            poor_sleep_sample: poorSleep.length,
          },
          significance: Math.abs(delta) >= 15 ? "high" : "medium",
        });
      }
    }
  }

  // ── 2. Sleep stage quality (deep+REM %) → workout intensity ─────────────
  const sleepQualityVsWorkout = workouts
    .map((w) => {
      const prevNight = sleepRecords.find(
        (s) => s.date === format(subDays(new Date(w.date), 1), "yyyy-MM-dd")
      );
      if (!prevNight?.duration_minutes || !w.intensity_score) return null;
      const deepRem = (prevNight.deep_sleep_minutes ?? 0) + (prevNight.rem_sleep_minutes ?? 0);
      if (prevNight.duration_minutes < 60 || deepRem === 0) return null;
      const qualityPct = deepRem / prevNight.duration_minutes;
      return { qualityPct, intensity: w.intensity_score };
    })
    .filter((x): x is { qualityPct: number; intensity: number } => x !== null);

  if (sleepQualityVsWorkout.length >= 5) {
    const highQuality = sleepQualityVsWorkout.filter((x) => x.qualityPct >= 0.45);
    const lowQuality = sleepQualityVsWorkout.filter((x) => x.qualityPct < 0.35);
    if (highQuality.length >= 2 && lowQuality.length >= 2) {
      const highAvg = Math.round(mean(highQuality.map((x) => x.intensity)));
      const lowAvg = Math.round(mean(lowQuality.map((x) => x.intensity)));
      const delta = highAvg - lowAvg;
      if (Math.abs(delta) >= 8) {
        const avgHighPct = Math.round(mean(highQuality.map((x) => x.qualityPct)) * 100);
        const avgLowPct = Math.round(mean(lowQuality.map((x) => x.qualityPct)) * 100);
        patterns.push({
          type: "sleep_quality_correlation",
          description: `Workout intensity is ${Math.abs(delta)} points higher after high-quality sleep (${avgHighPct}% deep+REM) vs shallow nights (${avgLowPct}% deep+REM) — avg intensity ${highAvg} vs ${lowAvg}. ${sleepQualityVsWorkout.length} workouts analyzed.`,
          data: {
            high_quality_avg: highAvg,
            low_quality_avg: lowAvg,
            delta,
            high_pct: avgHighPct,
            low_pct: avgLowPct,
            sample_size: sleepQualityVsWorkout.length,
          },
          significance: Math.abs(delta) >= 15 ? "high" : "medium",
        });
      }
    }
  }

  // ── 3. Previous-night sleep duration → next-day mood ────────────────────
  if (checkIns.length >= 5) {
    const sleepByDate = new Map(sleepRecords.map((s) => [s.date, s.duration_minutes]));
    const moodAfterGoodSleep: number[] = [];
    const moodAfterPoorSleep: number[] = [];

    checkIns.forEach((c) => {
      const prevDate = format(subDays(new Date(c.date), 1), "yyyy-MM-dd");
      const sleep = sleepByDate.get(prevDate);
      if (sleep == null) return;
      if (sleep >= 420) moodAfterGoodSleep.push(c.mood);
      else if (sleep < 360) moodAfterPoorSleep.push(c.mood);
    });

    if (moodAfterGoodSleep.length >= 3 && moodAfterPoorSleep.length >= 3) {
      const goodAvg = Math.round(mean(moodAfterGoodSleep) * 10) / 10;
      const poorAvg = Math.round(mean(moodAfterPoorSleep) * 10) / 10;
      const delta = goodAvg - poorAvg;
      if (delta >= 1.0) {
        patterns.push({
          type: "mood_sleep_correlation",
          description: `Mood is ${delta.toFixed(1)} points higher after 7h+ sleep vs under 6h (${goodAvg}/10 vs ${poorAvg}/10). ${moodAfterGoodSleep.length + moodAfterPoorSleep.length} check-ins analyzed.`,
          data: {
            mood_good_sleep: goodAvg,
            mood_poor_sleep: poorAvg,
            delta,
            good_count: moodAfterGoodSleep.length,
            poor_count: moodAfterPoorSleep.length,
          },
          significance: delta >= 2.0 ? "high" : "medium",
        });
      }
    }
  }

  // ── 4. Workout days vs rest days → energy levels ────────────────────────
  if (checkIns.length >= 5) {
    const workoutDates = new Set(workouts.map((w) => w.date));
    const energyWorkout: number[] = [];
    const energyRest: number[] = [];

    checkIns.forEach((c) => {
      if (workoutDates.has(c.date)) energyWorkout.push(c.energy);
      else energyRest.push(c.energy);
    });

    if (energyWorkout.length >= 3 && energyRest.length >= 3) {
      const workoutAvg = Math.round(mean(energyWorkout) * 10) / 10;
      const restAvg = Math.round(mean(energyRest) * 10) / 10;
      const delta = Math.abs(workoutAvg - restAvg);
      if (delta >= 1.0) {
        patterns.push({
          type: "energy_workout_correlation",
          description: `Energy is ${delta.toFixed(1)} points ${workoutAvg > restAvg ? "higher" : "lower"} on workout days vs rest days (${workoutAvg}/10 vs ${restAvg}/10). ${energyWorkout.length + energyRest.length} days analyzed.`,
          data: {
            energy_workout: workoutAvg,
            energy_rest: restAvg,
            delta,
            workout_days: energyWorkout.length,
            rest_days: energyRest.length,
          },
          significance: delta >= 2.0 ? "high" : "medium",
        });
      }
    }
  }

  // ── 5. High-stress days → next night's sleep duration ───────────────────
  if (checkIns.length >= 5) {
    const sleepByDate = new Map(sleepRecords.map((s) => [s.date, s.duration_minutes]));
    const sleepAfterHighStress: number[] = [];
    const sleepAfterLowStress: number[] = [];

    checkIns.forEach((c) => {
      const nextDate = format(subDays(new Date(c.date), -1), "yyyy-MM-dd");
      const sleep = sleepByDate.get(nextDate);
      if (sleep == null) return;
      if (c.stress >= 7) sleepAfterHighStress.push(sleep);
      else if (c.stress <= 3) sleepAfterLowStress.push(sleep);
    });

    if (sleepAfterHighStress.length >= 2 && sleepAfterLowStress.length >= 2) {
      const highAvgH = Math.round((mean(sleepAfterHighStress) / 60) * 10) / 10;
      const lowAvgH = Math.round((mean(sleepAfterLowStress) / 60) * 10) / 10;
      const delta = lowAvgH - highAvgH;
      if (delta >= 0.3) {
        patterns.push({
          type: "stress_sleep_correlation",
          description: `High-stress days (7+/10) are followed by ${delta.toFixed(1)}h less sleep than calm days (${highAvgH}h vs ${lowAvgH}h). ${sleepAfterHighStress.length + sleepAfterLowStress.length} nights analyzed.`,
          data: {
            sleep_after_stress: highAvgH,
            sleep_after_calm: lowAvgH,
            delta_hours: delta,
            stress_count: sleepAfterHighStress.length,
            calm_count: sleepAfterLowStress.length,
          },
          significance: delta >= 0.75 ? "high" : "medium",
        });
      }
    }
  }

  // ── 6. Bedtime timing → next-day energy ─────────────────────────────────
  if (checkIns.length >= 5) {
    const energyByDate = new Map(checkIns.map((c) => [c.date, c.energy]));
    const bedtimesWithEnergy = sleepRecords
      .filter((s) => s.bedtime != null)
      .map((s) => {
        const bt = new Date(s.bedtime!);
        const bedtimeHour = bt.getUTCHours() + bt.getUTCMinutes() / 60;
        // Normalize: hours before 6am count as post-midnight (e.g. 1am = 25h)
        const normalizedHour = bedtimeHour < 6 ? bedtimeHour + 24 : bedtimeHour;
        const energy = energyByDate.get(s.date);
        return energy != null ? { bedtimeHour: normalizedHour, energy } : null;
      })
      .filter((x): x is { bedtimeHour: number; energy: number } => x !== null);

    if (bedtimesWithEnergy.length >= 5) {
      const earlyBed = bedtimesWithEnergy.filter((x) => x.bedtimeHour <= 23);
      const lateBed = bedtimesWithEnergy.filter((x) => x.bedtimeHour > 23.5);
      if (earlyBed.length >= 2 && lateBed.length >= 2) {
        const earlyEnergy = Math.round(mean(earlyBed.map((x) => x.energy)) * 10) / 10;
        const lateEnergy = Math.round(mean(lateBed.map((x) => x.energy)) * 10) / 10;
        const delta = earlyEnergy - lateEnergy;
        if (Math.abs(delta) >= 1.0) {
          // Find the bedtime hour of the top-quartile highest-energy nights
          const sorted = [...bedtimesWithEnergy].sort((a, b) => b.energy - a.energy);
          const topCount = Math.max(2, Math.ceil(sorted.length / 4));
          const optHour = mean(sorted.slice(0, topCount).map((x) => x.bedtimeHour));
          const optH = Math.floor(optHour % 24);
          const optM = Math.round((optHour % 1) * 60);
          patterns.push({
            type: "bedtime_energy_correlation",
            description: `Next-day energy is ${Math.abs(delta).toFixed(1)} points higher after earlier bedtimes vs late nights (${earlyEnergy}/10 vs ${lateEnergy}/10). Your highest-energy days follow a ~${optH}:${optM.toString().padStart(2, "0")} bedtime. ${bedtimesWithEnergy.length} nights analyzed.`,
            data: {
              early_energy: earlyEnergy,
              late_energy: lateEnergy,
              delta,
              optimal_bedtime_hour: Math.round(optHour * 10) / 10,
              optimal_bedtime_hhmm: `${optH}:${optM.toString().padStart(2, "0")}`,
              sample_size: bedtimesWithEnergy.length,
            },
            significance: Math.abs(delta) >= 2.0 ? "high" : "medium",
          });
        }
      }
    }
  }

  // ── 7. Workout day → next-day stress level ──────────────────────────────
  if (checkIns.length >= 5 && workouts.length >= 5) {
    const workoutDates = new Set(workouts.map((w) => w.date));
    const stressAfterWorkout: number[] = [];
    const stressAfterRest: number[] = [];

    checkIns.forEach((c) => {
      const prevDate = format(subDays(new Date(c.date), 1), "yyyy-MM-dd");
      if (workoutDates.has(prevDate)) stressAfterWorkout.push(c.stress);
      else stressAfterRest.push(c.stress);
    });

    if (stressAfterWorkout.length >= 3 && stressAfterRest.length >= 3) {
      const workoutAvg = Math.round(mean(stressAfterWorkout) * 10) / 10;
      const restAvg = Math.round(mean(stressAfterRest) * 10) / 10;
      const delta = restAvg - workoutAvg; // positive = workout reduces next-day stress
      if (Math.abs(delta) >= 1.0) {
        patterns.push({
          type: "workout_stress_correlation",
          description: `Stress is ${Math.abs(delta).toFixed(1)} points ${delta > 0 ? "lower" : "higher"} the day after a workout vs a rest day (${workoutAvg}/10 vs ${restAvg}/10). ${stressAfterWorkout.length + stressAfterRest.length} days analyzed.`,
          data: {
            stress_after_workout: workoutAvg,
            stress_after_rest: restAvg,
            delta,
            workout_count: stressAfterWorkout.length,
            rest_count: stressAfterRest.length,
          },
          significance: Math.abs(delta) >= 2.0 ? "high" : "medium",
        });
      }
    }
  }

  // ── CHESS PATTERNS ─────────────────────────────────────────────────────────

  if (chessGames.length >= 5) {
    // Helper: games in last N days
    const chessInRange = (days: number) => {
      const cutoff = format(subDays(new Date(), days), "yyyy-MM-dd");
      return chessGames.filter((g) => g.date >= cutoff);
    };

    const recent30 = chessInRange(30);
    const winRate = (games: ChessGame[]) =>
      games.length > 0 ? games.filter((g) => g.result === "win").length / games.length : 0;
    const avgAccuracy = (games: ChessGame[]) => {
      const withAcc = games.filter((g) => g.accuracy !== null);
      return withAcc.length > 0 ? mean(withAcc.map((g) => g.accuracy!)) : null;
    };

    // ── 8. RATING_TREND — linear regression per time class ────────────────
    for (const tc of ["rapid", "blitz", "bullet"] as const) {
      const tcGames = recent30.filter((g) => g.time_class === tc);
      if (tcGames.length < 5) continue;

      // Simple linear regression: x = game index, y = rating
      const n = tcGames.length;
      const xs = tcGames.map((_, i) => i);
      const ys = tcGames.map((g) => g.player_rating);
      const xMean = mean(xs);
      const yMean = mean(ys);
      const num = xs.reduce((sum, x, i) => sum + (x - xMean) * (ys[i] - yMean), 0);
      const den = xs.reduce((sum, x) => sum + (x - xMean) ** 2, 0);
      const slope = den !== 0 ? num / den : 0;
      const totalChange = Math.round(slope * (n - 1));

      if (Math.abs(totalChange) >= 20) {
        const direction = totalChange > 0 ? "climbed" : "dropped";
        const first = ys[0];
        const last = ys[n - 1];
        patterns.push({
          type: "chess_rating_trend",
          description: `Your ${tc} rating has ${direction} ${Math.abs(totalChange)} points over the last 30 days (${first} → ${last}). ${n} games analyzed.`,
          data: {
            time_class: tc,
            start_rating: first,
            end_rating: last,
            total_change: totalChange,
            slope_per_game: Math.round(slope * 100) / 100,
            games: n,
          },
          significance: Math.abs(totalChange) >= 50 ? "high" : "medium",
        });
      }
    }

    // ── 9. TIME_OF_DAY_PERFORMANCE ────────────────────────────────────────
    if (recent30.length >= 10) {
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

      // Find best and worst slots with enough data
      const validSlots = Object.entries(slotStats).filter(([, v]) => v.games.length >= 3);
      if (validSlots.length >= 2) {
        const best = validSlots.reduce((a, b) => (a[1].wr > b[1].wr ? a : b));
        const worst = validSlots.reduce((a, b) => (a[1].wr < b[1].wr ? a : b));
        const delta = best[1].wr - worst[1].wr;

        if (delta >= 10) {
          patterns.push({
            type: "chess_time_of_day",
            description: `You win ${best[1].wr}% of games played ${slots[best[0]].label} vs ${worst[1].wr}% ${slots[worst[0]].label}. ${recent30.length} games analyzed.`,
            data: {
              best_slot: best[0],
              best_wr: best[1].wr,
              best_games: best[1].games.length,
              worst_slot: worst[0],
              worst_wr: worst[1].wr,
              worst_games: worst[1].games.length,
              delta,
            },
            significance: delta >= 15 ? "high" : "medium",
          });
        }
      }
    }

    // ── 10. GAME_VOLUME_VS_PERFORMANCE ────────────────────────────────────
    if (recent30.length >= 15) {
      // Group games by date, compare performance in first 4 games vs 5+ games
      const byDate = new Map<string, ChessGame[]>();
      for (const g of recent30) {
        const arr = byDate.get(g.date) ?? [];
        arr.push(g);
        byDate.set(g.date, arr);
      }

      const earlyGames: ChessGame[] = [];
      const lateGames: ChessGame[] = [];
      for (const games of byDate.values()) {
        // Sort by played_at to get order within day
        const sorted = [...games].sort((a, b) => a.played_at.localeCompare(b.played_at));
        sorted.forEach((g, i) => {
          if (i < 4) earlyGames.push(g);
          else lateGames.push(g);
        });
      }

      if (lateGames.length >= 5) {
        const earlyWR = Math.round(winRate(earlyGames) * 100);
        const lateWR = Math.round(winRate(lateGames) * 100);
        const earlyAcc = avgAccuracy(earlyGames);
        const lateAcc = avgAccuracy(lateGames);
        const wrDelta = earlyWR - lateWR;
        const accDelta = earlyAcc !== null && lateAcc !== null ? Math.round(earlyAcc - lateAcc) : null;

        if (wrDelta >= 8 || (accDelta !== null && accDelta >= 5)) {
          const parts: string[] = [];
          if (wrDelta >= 5) parts.push(`win rate drops ${wrDelta}% (${earlyWR}% → ${lateWR}%)`);
          if (accDelta !== null && accDelta >= 3) parts.push(`accuracy drops ${accDelta}% (${Math.round(earlyAcc!)}% → ${Math.round(lateAcc!)}%)`);

          patterns.push({
            type: "chess_volume_performance",
            description: `After your 4th game in a session, ${parts.join(" and ")}. Quality over quantity — ${lateGames.length} late-session games analyzed.`,
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
            significance: wrDelta >= 15 || (accDelta !== null && accDelta >= 8) ? "high" : "medium",
          });
        }
      }
    }

    // ── CROSS-DOMAIN: Chess + Sleep/Workout/Check-ins ────────────────────

    const sleepByDate = new Map(sleepRecords.map((s) => [s.date, s.duration_minutes]));
    const workoutDates = new Set(workouts.map((w) => w.date));
    const checkInByDate = new Map(checkIns.map((c) => [c.date, c]));

    // ── 11. CHESS_SLEEP_CORRELATION ───────────────────────────────────────
    {
      const afterGoodSleep: ChessGame[] = [];
      const afterPoorSleep: ChessGame[] = [];

      for (const g of recent30) {
        const prevDate = format(subDays(new Date(g.date), 1), "yyyy-MM-dd");
        const sleep = sleepByDate.get(prevDate);
        if (sleep == null) continue;
        if (sleep >= 420) afterGoodSleep.push(g);
        else if (sleep < 360) afterPoorSleep.push(g);
      }

      if (afterGoodSleep.length >= 3 && afterPoorSleep.length >= 3) {
        const goodWR = Math.round(winRate(afterGoodSleep) * 100);
        const poorWR = Math.round(winRate(afterPoorSleep) * 100);
        const wrDelta = goodWR - poorWR;

        const goodAcc = avgAccuracy(afterGoodSleep);
        const poorAcc = avgAccuracy(afterPoorSleep);
        const accDelta = goodAcc !== null && poorAcc !== null ? Math.round(goodAcc - poorAcc) : null;

        if (Math.abs(wrDelta) >= 8 || (accDelta !== null && Math.abs(accDelta) >= 5)) {
          const parts: string[] = [];
          if (Math.abs(wrDelta) >= 5) parts.push(`win rate is ${wrDelta > 0 ? wrDelta : Math.abs(wrDelta)}% ${wrDelta > 0 ? "higher" : "lower"} (${goodWR}% vs ${poorWR}%)`);
          if (accDelta !== null && Math.abs(accDelta) >= 3) parts.push(`accuracy is ${accDelta > 0 ? accDelta : Math.abs(accDelta)}% ${accDelta > 0 ? "higher" : "lower"} (${Math.round(goodAcc!)}% vs ${Math.round(poorAcc!)}%)`);

          patterns.push({
            type: "chess_sleep_correlation",
            description: `After 7+ hours of sleep, your chess ${parts.join(" and ")} compared to nights under 6 hours. ${afterGoodSleep.length + afterPoorSleep.length} games analyzed.`,
            data: {
              good_sleep_wr: goodWR,
              poor_sleep_wr: poorWR,
              wr_delta: wrDelta,
              good_sleep_accuracy: goodAcc !== null ? Math.round(goodAcc) : null,
              poor_sleep_accuracy: poorAcc !== null ? Math.round(poorAcc) : null,
              accuracy_delta: accDelta,
              good_sleep_games: afterGoodSleep.length,
              poor_sleep_games: afterPoorSleep.length,
            },
            significance: Math.abs(wrDelta) >= 10 || (accDelta !== null && Math.abs(accDelta) >= 10) ? "high" : "medium",
          });
        }
      }
    }

    // ── 12. CHESS_EXERCISE_CORRELATION ────────────────────────────────────
    {
      const onWorkoutDays = recent30.filter((g) => workoutDates.has(g.date));
      const onRestDays = recent30.filter((g) => !workoutDates.has(g.date));

      if (onWorkoutDays.length >= 3 && onRestDays.length >= 3) {
        const workoutWR = Math.round(winRate(onWorkoutDays) * 100);
        const restWR = Math.round(winRate(onRestDays) * 100);
        const wrDelta = workoutWR - restWR;

        if (Math.abs(wrDelta) >= 8) {
          patterns.push({
            type: "chess_exercise_correlation",
            description: `On workout days, your chess win rate is ${workoutWR}% vs ${restWR}% on rest days — a ${Math.abs(wrDelta)}% ${wrDelta > 0 ? "boost" : "drop"}. ${onWorkoutDays.length + onRestDays.length} games analyzed.`,
            data: {
              workout_wr: workoutWR,
              rest_wr: restWR,
              wr_delta: wrDelta,
              workout_games: onWorkoutDays.length,
              rest_games: onRestDays.length,
            },
            significance: Math.abs(wrDelta) >= 10 ? "high" : "medium",
          });
        }
      }
    }

    // ── 13. CHESS_MOOD_CORRELATION ────────────────────────────────────────
    if (checkIns.length >= 5) {
      const highMoodGames: ChessGame[] = [];
      const lowMoodGames: ChessGame[] = [];

      for (const g of recent30) {
        const ci = checkInByDate.get(g.date);
        if (!ci) continue;
        if (ci.mood > 7) highMoodGames.push(g);
        else if (ci.mood < 5) lowMoodGames.push(g);
      }

      if (highMoodGames.length >= 3 && lowMoodGames.length >= 3) {
        const highWR = Math.round(winRate(highMoodGames) * 100);
        const lowWR = Math.round(winRate(lowMoodGames) * 100);
        const wrDelta = highWR - lowWR;

        if (Math.abs(wrDelta) >= 8) {
          patterns.push({
            type: "chess_mood_correlation",
            description: `When your mood is above 7, your chess win rate is ${highWR}% vs ${lowWR}% when mood is below 5 — a ${Math.abs(wrDelta)}% difference. ${highMoodGames.length + lowMoodGames.length} games analyzed.`,
            data: {
              high_mood_wr: highWR,
              low_mood_wr: lowWR,
              wr_delta: wrDelta,
              high_mood_games: highMoodGames.length,
              low_mood_games: lowMoodGames.length,
            },
            significance: Math.abs(wrDelta) >= 10 ? "high" : "medium",
          });
        }
      }
    }

    // ── 14. CHESS_STRESS_CORRELATION ──────────────────────────────────────
    if (checkIns.length >= 5) {
      const highStressGames: ChessGame[] = [];
      const lowStressGames: ChessGame[] = [];

      for (const g of recent30) {
        const ci = checkInByDate.get(g.date);
        if (!ci) continue;
        if (ci.stress > 7) highStressGames.push(g);
        else if (ci.stress < 4) lowStressGames.push(g);
      }

      if (highStressGames.length >= 3 && lowStressGames.length >= 3) {
        const highWR = Math.round(winRate(highStressGames) * 100);
        const lowWR = Math.round(winRate(lowStressGames) * 100);
        const wrDelta = lowWR - highWR; // positive = low stress is better

        const highAvgRating = Math.round(mean(highStressGames.map((g) => g.player_rating)));
        const lowAvgRating = Math.round(mean(lowStressGames.map((g) => g.player_rating)));
        const ratingDelta = lowAvgRating - highAvgRating;

        if (Math.abs(wrDelta) >= 8 || Math.abs(ratingDelta) >= 20) {
          const parts: string[] = [];
          if (Math.abs(wrDelta) >= 5) parts.push(`win rate ${wrDelta > 0 ? "jumps to" : "drops to"} ${lowWR}% vs ${highWR}% on high-stress days`);
          if (Math.abs(ratingDelta) >= 15) parts.push(`average rating is ${Math.abs(ratingDelta)} points ${ratingDelta > 0 ? "higher" : "lower"} when calm`);

          patterns.push({
            type: "chess_stress_correlation",
            description: `When stress is low (<4), ${parts.join(" and ")}. ${highStressGames.length + lowStressGames.length} games analyzed.`,
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
            significance: Math.abs(wrDelta) >= 10 || Math.abs(ratingDelta) >= 30 ? "high" : "medium",
          });
        }
      }
    }

    // ── 15. CHESS_ENERGY_CORRELATION ──────────────────────────────────────
    if (checkIns.length >= 5) {
      const highEnergyGames: ChessGame[] = [];
      const lowEnergyGames: ChessGame[] = [];

      for (const g of recent30) {
        const ci = checkInByDate.get(g.date);
        if (!ci) continue;
        if (ci.energy > 7) highEnergyGames.push(g);
        else if (ci.energy < 5) lowEnergyGames.push(g);
      }

      if (highEnergyGames.length >= 3 && lowEnergyGames.length >= 3) {
        const highAcc = avgAccuracy(highEnergyGames);
        const lowAcc = avgAccuracy(lowEnergyGames);
        const highWR = Math.round(winRate(highEnergyGames) * 100);
        const lowWR = Math.round(winRate(lowEnergyGames) * 100);
        const wrDelta = highWR - lowWR;
        const accDelta = highAcc !== null && lowAcc !== null ? Math.round(highAcc - lowAcc) : null;

        if (Math.abs(wrDelta) >= 8 || (accDelta !== null && Math.abs(accDelta) >= 5)) {
          const parts: string[] = [];
          if (accDelta !== null && Math.abs(accDelta) >= 3) parts.push(`accuracy is ${Math.abs(accDelta)}% ${accDelta > 0 ? "higher" : "lower"} (${Math.round(highAcc!)}% vs ${Math.round(lowAcc!)}%)`);
          if (Math.abs(wrDelta) >= 5) parts.push(`win rate is ${Math.abs(wrDelta)}% ${wrDelta > 0 ? "higher" : "lower"} (${highWR}% vs ${lowWR}%)`);

          patterns.push({
            type: "chess_energy_correlation",
            description: `When energy is above 7, your chess ${parts.join(" and ")} compared to low-energy days (<5). ${highEnergyGames.length + lowEnergyGames.length} games analyzed.`,
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
            significance: Math.abs(wrDelta) >= 10 || (accDelta !== null && Math.abs(accDelta) >= 10) ? "high" : "medium",
          });
        }
      }
    }
  }

  const order = { high: 0, medium: 1, low: 2 };
  return patterns.sort((a, b) => order[a.significance] - order[b.significance]);
}

/** Single-domain stat summaries — feed into Common/Uncommon insight tiers. */
export function detectBasicStats({
  sleepRecords,
  workouts,
  dailyMetrics,
  checkIns,
}: PatternInput): DetectedPattern[] {
  const patterns: DetectedPattern[] = [];

  // ── Average sleep duration (stat summary) ────────────────────────────────
  const sleepDurations = sleepRecords
    .map((s) => s.duration_minutes)
    .filter((v): v is number => v != null);

  if (sleepDurations.length >= 3) {
    const avg = mean(sleepDurations);
    const avgH = Math.round((avg / 60) * 10) / 10;
    patterns.push({
      type: "stat_summary",
      description: `Average sleep over the last ${sleepDurations.length} nights: ${avgH}h.`,
      data: { avg_minutes: Math.round(avg), avg_hours: avgH, nights: sleepDurations.length },
      significance: "low",
    });

    // Sleep duration trend (Uncommon tier if significant)
    const trend = halfTrend(sleepDurations.slice(-14));
    const last7 = sleepDurations.slice(-7);
    const prior7 = sleepDurations.slice(-14, -7);
    if (last7.length >= 3 && prior7.length >= 3) {
      const recentAvg = mean(last7);
      const priorAvg = mean(prior7);
      const deltaMins = Math.round(recentAvg - priorAvg);
      if (trend !== "flat" && Math.abs(deltaMins) >= 20) {
        patterns.push({
          type: "single_domain_trend",
          description: `Sleep duration trending ${trend}: ${deltaMins > 0 ? "+" : ""}${deltaMins} min vs prior week (recent avg ${Math.round(recentAvg / 6) / 10}h).`,
          data: { trend, delta_minutes: deltaMins, recent_avg: Math.round(recentAvg), prior_avg: Math.round(priorAvg) },
          significance: Math.abs(deltaMins) > 45 ? "medium" : "low",
        });
      }
    }
  }

  // ── Bedtime consistency (single-domain) ──────────────────────────────────
  const bedtimes = sleepRecords
    .filter((s) => s.bedtime != null)
    .map((s) => {
      const bt = new Date(s.bedtime!);
      const h = bt.getUTCHours() + bt.getUTCMinutes() / 60;
      return h < 6 ? h + 24 : h;
    });

  if (bedtimes.length >= 7) {
    const avg = mean(bedtimes);
    const sd = Math.sqrt(mean(bedtimes.map((b) => (b - avg) ** 2)));
    const avgH = Math.floor(avg % 24);
    const avgM = Math.round((avg % 1) * 60);
    if (sd > 0.5) {
      patterns.push({
        type: "single_domain_trend",
        description: `Bedtime varies significantly (±${Math.round(sd * 60)} min, avg ${avgH}:${avgM.toString().padStart(2, "0")}).`,
        data: { avg_bedtime_hhmm: `${avgH}:${avgM.toString().padStart(2, "0")}`, std_dev_mins: Math.round(sd * 60) },
        significance: sd > 1.0 ? "medium" : "low",
      });
    }
  }

  // ── Resting HR trend ─────────────────────────────────────────────────────
  const hrValues = dailyMetrics
    .map((m) => m.resting_heart_rate)
    .filter((v): v is number => v != null);

  if (hrValues.length >= 7) {
    const trend = halfTrend(hrValues);
    const recentAvg = Math.round(mean(hrValues.slice(-7)));
    const priorAvg = Math.round(mean(hrValues.slice(0, 7)));
    const delta = recentAvg - priorAvg;
    if (trend !== "flat") {
      patterns.push({
        type: "single_domain_trend",
        description: `Resting HR ${trend === "down" ? "dropping" : "rising"}: recent avg ${recentAvg} bpm vs ${priorAvg} bpm (${delta > 0 ? "+" : ""}${delta} bpm over 30 days).`,
        data: { trend, recent_avg: recentAvg, prior_avg: priorAvg, delta },
        significance: Math.abs(delta) >= 5 ? "medium" : "low",
      });
    } else {
      patterns.push({
        type: "stat_summary",
        description: `Resting heart rate stable at ~${recentAvg} bpm over the last 30 days.`,
        data: { avg: recentAvg },
        significance: "low",
      });
    }
  }

  // ── Workout frequency stat ────────────────────────────────────────────────
  if (workouts.length > 0) {
    const perWeek = (workouts.length / 4).toFixed(1);
    patterns.push({
      type: "stat_summary",
      description: `${workouts.length} workouts in 30 days (~${perWeek}/week average).`,
      data: { total: workouts.length, per_week: parseFloat(perWeek) },
      significance: "low",
    });
  }

  // ── Average mood/energy (if check-ins exist) ──────────────────────────────
  if (checkIns.length >= 5) {
    const avgMood = Math.round(mean(checkIns.map((c) => c.mood)) * 10) / 10;
    const avgEnergy = Math.round(mean(checkIns.map((c) => c.energy)) * 10) / 10;
    const avgStress = Math.round(mean(checkIns.map((c) => c.stress)) * 10) / 10;
    patterns.push({
      type: "stat_summary",
      description: `Check-in averages over ${checkIns.length} days: mood ${avgMood}/10, energy ${avgEnergy}/10, stress ${avgStress}/10.`,
      data: { avg_mood: avgMood, avg_energy: avgEnergy, avg_stress: avgStress, count: checkIns.length },
      significance: "low",
    });
  }

  return patterns;
}
