import { format, subDays } from "date-fns";
import { registerDetector } from "../detector-registry";
import type { UserDataBundle } from "../data-bundle";
import { mean, effectToSignificance } from "./utils";

// ── MOOD_SLEEP_CORRELATION: Previous-night sleep → next-day mood ─────────────
registerDetector({
  id: "MOOD_SLEEP_CORRELATION",
  name: "Sleep duration vs next-day mood",
  requiredDomains: ["sleep", "wellbeing"],
  category: "cross",
  detect: (data: UserDataBundle) => {
    if (data.checkins.length < 5) return null;

    const moodAfterGoodSleep: number[] = [];
    const moodAfterPoorSleep: number[] = [];

    for (const c of data.checkins) {
      const prevDate = format(subDays(new Date(c.date), 1), "yyyy-MM-dd");
      const sleep = data.sleepByDate.get(prevDate)?.duration_minutes;
      if (sleep == null) continue;
      if (sleep >= 420) moodAfterGoodSleep.push(c.mood);
      else if (sleep < 360) moodAfterPoorSleep.push(c.mood);
    }

    if (moodAfterGoodSleep.length < 3 || moodAfterPoorSleep.length < 3) return null;

    const goodAvg = Math.round(mean(moodAfterGoodSleep) * 10) / 10;
    const poorAvg = Math.round(mean(moodAfterPoorSleep) * 10) / 10;
    const delta = goodAvg - poorAvg;
    if (delta < 1.0) return null;

    const effectSize = delta / 10; // on 10-point scale
    return {
      detectorId: "MOOD_SLEEP_CORRELATION",
      type: "mood_sleep_correlation",
      description: `Mood is ${delta.toFixed(1)} points higher after 7h+ sleep vs under 6h (${goodAvg}/10 vs ${poorAvg}/10). ${moodAfterGoodSleep.length + moodAfterPoorSleep.length} check-ins analyzed.`,
      domains: ["sleep", "wellbeing"],
      data: {
        mood_good_sleep: goodAvg,
        mood_poor_sleep: poorAvg,
        delta,
        good_count: moodAfterGoodSleep.length,
        poor_count: moodAfterPoorSleep.length,
      },
      significance: effectToSignificance(effectSize, { low: 0.10, mid: 0.20, high: 0.30 }),
      effectSize,
    };
  },
});

// ── STRESS_SLEEP_CORRELATION: High-stress days → next night's sleep ──────────
registerDetector({
  id: "STRESS_SLEEP_CORRELATION",
  name: "Stress vs next-night sleep",
  requiredDomains: ["sleep", "wellbeing"],
  category: "cross",
  detect: (data: UserDataBundle) => {
    if (data.checkins.length < 5) return null;

    const sleepAfterHighStress: number[] = [];
    const sleepAfterLowStress: number[] = [];

    for (const c of data.checkins) {
      const nextDate = format(subDays(new Date(c.date), -1), "yyyy-MM-dd");
      const sleep = data.sleepByDate.get(nextDate)?.duration_minutes;
      if (sleep == null) continue;
      if (c.stress >= 7) sleepAfterHighStress.push(sleep);
      else if (c.stress <= 3) sleepAfterLowStress.push(sleep);
    }

    if (sleepAfterHighStress.length < 2 || sleepAfterLowStress.length < 2) return null;

    const highAvgH = Math.round((mean(sleepAfterHighStress) / 60) * 10) / 10;
    const lowAvgH = Math.round((mean(sleepAfterLowStress) / 60) * 10) / 10;
    const delta = lowAvgH - highAvgH;
    if (delta < 0.3) return null;

    const effectSize = delta / lowAvgH;
    return {
      detectorId: "STRESS_SLEEP_CORRELATION",
      type: "stress_sleep_correlation",
      description: `High-stress days (7+/10) are followed by ${delta.toFixed(1)}h less sleep than calm days (${highAvgH}h vs ${lowAvgH}h). ${sleepAfterHighStress.length + sleepAfterLowStress.length} nights analyzed.`,
      domains: ["sleep", "wellbeing"],
      data: {
        sleep_after_stress: highAvgH,
        sleep_after_calm: lowAvgH,
        delta_hours: delta,
        stress_count: sleepAfterHighStress.length,
        calm_count: sleepAfterLowStress.length,
      },
      significance: effectToSignificance(effectSize, { low: 0.04, mid: 0.08, high: 0.15 }),
      effectSize,
    };
  },
});

// ── BEDTIME_ENERGY_CORRELATION: Bedtime timing → next-day energy ─────────────
registerDetector({
  id: "BEDTIME_ENERGY_CORRELATION",
  name: "Bedtime timing vs next-day energy",
  requiredDomains: ["sleep", "wellbeing"],
  category: "cross",
  detect: (data: UserDataBundle) => {
    if (data.checkins.length < 5) return null;

    const bedtimesWithEnergy = data.sleepRecords
      .filter((s) => s.bedtime != null)
      .map((s) => {
        const bt = new Date(s.bedtime!);
        const bedtimeHour = bt.getUTCHours() + bt.getUTCMinutes() / 60;
        const normalizedHour = bedtimeHour < 6 ? bedtimeHour + 24 : bedtimeHour;
        const ci = data.checkinByDate.get(s.date);
        return ci ? { bedtimeHour: normalizedHour, energy: ci.energy } : null;
      })
      .filter((x): x is { bedtimeHour: number; energy: number } => x !== null);

    if (bedtimesWithEnergy.length < 5) return null;

    const earlyBed = bedtimesWithEnergy.filter((x) => x.bedtimeHour <= 23);
    const lateBed = bedtimesWithEnergy.filter((x) => x.bedtimeHour > 23.5);
    if (earlyBed.length < 2 || lateBed.length < 2) return null;

    const earlyEnergy = Math.round(mean(earlyBed.map((x) => x.energy)) * 10) / 10;
    const lateEnergy = Math.round(mean(lateBed.map((x) => x.energy)) * 10) / 10;
    const delta = earlyEnergy - lateEnergy;
    if (Math.abs(delta) < 1.0) return null;

    // Find optimal bedtime from top-quartile energy days
    const sorted = [...bedtimesWithEnergy].sort((a, b) => b.energy - a.energy);
    const topCount = Math.max(2, Math.ceil(sorted.length / 4));
    const optHour = mean(sorted.slice(0, topCount).map((x) => x.bedtimeHour));
    const optH = Math.floor(optHour % 24);
    const optM = Math.round((optHour % 1) * 60);

    const effectSize = Math.abs(delta) / 10;
    return {
      detectorId: "BEDTIME_ENERGY_CORRELATION",
      type: "bedtime_energy_correlation",
      description: `Next-day energy is ${Math.abs(delta).toFixed(1)} points higher after earlier bedtimes vs late nights (${earlyEnergy}/10 vs ${lateEnergy}/10). Your highest-energy days follow a ~${optH}:${optM.toString().padStart(2, "0")} bedtime. ${bedtimesWithEnergy.length} nights analyzed.`,
      domains: ["sleep", "wellbeing"],
      data: {
        early_energy: earlyEnergy,
        late_energy: lateEnergy,
        delta,
        optimal_bedtime_hour: Math.round(optHour * 10) / 10,
        optimal_bedtime_hhmm: `${optH}:${optM.toString().padStart(2, "0")}`,
        sample_size: bedtimesWithEnergy.length,
      },
      significance: effectToSignificance(effectSize, { low: 0.10, mid: 0.20, high: 0.30 }),
      effectSize,
    };
  },
});
