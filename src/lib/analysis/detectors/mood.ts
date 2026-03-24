import { registerDetector } from "../detector-registry";
import type { UserDataBundle } from "../data-bundle";
import { mean, effectToSignificance } from "./utils";
import { getDay } from "date-fns";

// ── MOOD_ENERGY_STAT: Average mood/energy/stress summary ─────────────────────
registerDetector({
  id: "MOOD_ENERGY_STAT",
  name: "Mood, energy, stress averages",
  requiredDomains: ["mood"],
  category: "single",
  detect: (data: UserDataBundle) => {
    if (data.checkins.length < 5) return null;

    const avgMood = Math.round(mean(data.checkins.map((c) => c.mood)) * 10) / 10;
    const avgEnergy = Math.round(mean(data.checkins.map((c) => c.energy)) * 10) / 10;
    const avgStress = Math.round(mean(data.checkins.map((c) => c.stress)) * 10) / 10;

    return {
      detectorId: "MOOD_ENERGY_STAT",
      type: "MOOD_ENERGY_STAT",
      description: `Check-in averages over ${data.checkins.length} days: mood ${avgMood}/10, energy ${avgEnergy}/10, stress ${avgStress}/10.`,
      domains: ["mood"],
      data: { avg_mood: avgMood, avg_energy: avgEnergy, avg_stress: avgStress, count: data.checkins.length },
      significance: 0.15,
      effectSize: 0,
    };
  },
});

// ── MOOD_VOLATILITY: Flag unusually volatile mood scores ────────────────────
registerDetector({
  id: "MOOD_VOLATILITY",
  name: "Mood volatility",
  requiredDomains: ["mood"],
  category: "single",
  detect: (data: UserDataBundle) => {
    if (data.checkins.length < 7) return null;

    const sorted = [...data.checkins].sort(
      (a, b) => a.date.localeCompare(b.date),
    );
    const recent14 = sorted.slice(-14);
    const recentMoods = recent14.map((c) => c.mood);

    const avg = mean(recentMoods);
    const stdev = Math.sqrt(
      mean(recentMoods.map((m) => (m - avg) ** 2)),
    );

    if (stdev <= 2) return null;

    const minMood = Math.min(...recentMoods);
    const maxMood = Math.max(...recentMoods);

    const effectSize = stdev / 10; // normalise to 0-1 range
    const significance = effectToSignificance(effectSize, {
      low: 0.15,
      mid: 0.25,
      high: 0.35,
    });

    return {
      detectorId: "MOOD_VOLATILITY",
      type: "MOOD_VOLATILITY",
      description: `Your mood has been unusually volatile this week — swinging between ${minMood} and ${maxMood}.`,
      domains: ["mood"],
      data: { stdev: Math.round(stdev * 100) / 100, minMood, maxMood },
      significance,
      effectSize,
    };
  },
});

// ── ENERGY_DECLINE_PATTERN: Detect declining energy trend ───────────────────
registerDetector({
  id: "ENERGY_DECLINE_PATTERN",
  name: "Energy decline pattern",
  requiredDomains: ["mood"],
  category: "single",
  detect: (data: UserDataBundle) => {
    if (data.checkins.length < 7) return null;

    const sorted = [...data.checkins].sort(
      (a, b) => a.date.localeCompare(b.date),
    );
    const recent7 = sorted.slice(-7).map((c) => c.energy);
    const all30 = sorted.slice(-30).map((c) => c.energy);

    const avg7 = Math.round(mean(recent7) * 10) / 10;
    const avg30 = Math.round(mean(all30) * 10) / 10;
    const decline = avg30 - avg7;

    if (decline <= 1) return null;

    const effectSize = decline / 10;
    const significance = effectToSignificance(effectSize, {
      low: 0.10,
      mid: 0.20,
      high: 0.30,
    });

    return {
      detectorId: "ENERGY_DECLINE_PATTERN",
      type: "ENERGY_DECLINE_PATTERN",
      description: `Your energy has dropped from ${avg30} to ${avg7} over the past week.`,
      domains: ["mood"],
      data: { avg7, avg30, decline: Math.round(decline * 10) / 10 },
      significance,
      effectSize,
    };
  },
});

// ── STRESS_SPIKE_FREQUENCY: Compare high-stress day counts ──────────────────
registerDetector({
  id: "STRESS_SPIKE_FREQUENCY",
  name: "Stress spike frequency",
  requiredDomains: ["mood"],
  category: "single",
  detect: (data: UserDataBundle) => {
    if (data.checkins.length < 7) return null;

    const sorted = [...data.checkins].sort(
      (a, b) => a.date.localeCompare(b.date),
    );
    const recent14 = sorted.slice(-14);
    const prior14 = sorted.slice(-28, -14);

    const recentHighStress = recent14.filter((c) => c.stress >= 7).length;
    const priorHighStress = prior14.filter((c) => c.stress >= 7).length;

    if (recentHighStress <= priorHighStress) return null;

    const effectSize =
      (recentHighStress - priorHighStress) / Math.max(recent14.length, 1);
    const significance = effectToSignificance(effectSize, {
      low: 0.10,
      mid: 0.25,
      high: 0.40,
    });

    return {
      detectorId: "STRESS_SPIKE_FREQUENCY",
      type: "STRESS_SPIKE_FREQUENCY",
      description: `You reported high stress ${recentHighStress} out of the last 14 days, up from ${priorHighStress} in the prior 2 weeks.`,
      domains: ["mood"],
      data: { recentHighStress, priorHighStress },
      significance,
      effectSize,
    };
  },
});

// ── MOOD_DAY_OF_WEEK: Mood patterns by day of week ─────────────────────────
registerDetector({
  id: "MOOD_DAY_OF_WEEK",
  name: "Mood by day of week",
  requiredDomains: ["mood"],
  category: "single",
  detect: (data: UserDataBundle) => {
    if (data.checkins.length < 7) return null;

    const dayNames = [
      "Sundays",
      "Mondays",
      "Tuesdays",
      "Wednesdays",
      "Thursdays",
      "Fridays",
      "Saturdays",
    ];

    const buckets: Record<number, number[]> = {};
    for (const c of data.checkins) {
      const day = getDay(new Date(c.date + "T00:00:00"));
      if (!buckets[day]) buckets[day] = [];
      buckets[day].push(c.mood);
    }

    // Only include days with 3+ data points
    const qualified = Object.entries(buckets)
      .filter(([, moods]) => moods.length >= 3)
      .map(([day, moods]) => ({
        day: Number(day),
        avg: Math.round(mean(moods) * 10) / 10,
      }));

    if (qualified.length < 2) return null;

    qualified.sort((a, b) => a.avg - b.avg);
    const worst = qualified[0];
    const best = qualified[qualified.length - 1];
    const spread = best.avg - worst.avg;

    if (spread < 1) return null;

    const effectSize = spread / 10;
    const significance = effectToSignificance(effectSize, {
      low: 0.10,
      mid: 0.20,
      high: 0.30,
    });

    return {
      detectorId: "MOOD_DAY_OF_WEEK",
      type: "MOOD_DAY_OF_WEEK",
      description: `Your mood averages ${best.avg} on ${dayNames[best.day]} but drops to ${worst.avg} on ${dayNames[worst.day]}.`,
      domains: ["mood"],
      data: { bestDay: dayNames[best.day], bestAvg: best.avg, worstDay: dayNames[worst.day], worstAvg: worst.avg, spread },
      significance,
      effectSize,
    };
  },
});
