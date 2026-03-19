import { format, subDays } from "date-fns";
import type { SleepRecord, Workout, DailyMetrics, CheckIn, DetectedPattern } from "@/types/index";

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
  today: Date;
}

export function detectPatterns({ sleepRecords, workouts, checkIns }: PatternInput): DetectedPattern[] {
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
