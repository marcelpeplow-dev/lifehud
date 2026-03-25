import { registerDetector } from "../detector-registry";
import type { UserDataBundle } from "../data-bundle";
import { mean, effectToSignificance } from "./utils";
import { format, subDays } from "date-fns";

const HIGH_HYDRATION = 2.5;
const LOW_HYDRATION = 2.0;

function getEnergy(data: UserDataBundle, date: string): number | null {
  const manual = data.manualByDateAndMetric.get(date);
  return manual?.get("wellbeing_energy") ?? data.checkinByDate.get(date)?.energy ?? null;
}

function getMood(data: UserDataBundle, date: string): number | null {
  const manual = data.manualByDateAndMetric.get(date);
  return manual?.get("wellbeing_mood") ?? data.checkinByDate.get(date)?.mood ?? null;
}

// ── HYDRATION_VS_ENERGY: Water intake → energy levels ─────────────────────────
registerDetector({
  id: "HYDRATION_VS_ENERGY",
  name: "Hydration vs energy",
  requiredDomains: ["hydration", "wellbeing"],
  category: "cross",
  detect: (data: UserDataBundle) => {
    const cutoff = format(subDays(new Date(), 30), "yyyy-MM-dd");

    const highEnergy: number[] = [];
    const lowEnergy: number[] = [];

    for (const [date, metrics] of data.manualByDateAndMetric) {
      if (date < cutoff) continue;
      const intake = metrics.get("hydration_water_intake");
      if (intake == null) continue;
      const energy = getEnergy(data, date);
      if (energy == null) continue;

      if (intake >= HIGH_HYDRATION) highEnergy.push(energy);
      else if (intake < LOW_HYDRATION) lowEnergy.push(energy);
    }

    if (highEnergy.length < 3 || lowEnergy.length < 3) return null;

    const highAvg = mean(highEnergy);
    const lowAvg = mean(lowEnergy);
    const delta = highAvg - lowAvg; // positive = better hydration → more energy

    if (Math.abs(delta) < 0.5) return null;

    const effectSize = Math.min(Math.abs(delta) / 10, 1);
    const significance = effectToSignificance(effectSize, { low: 0.05, mid: 0.10, high: 0.15 });

    return {
      detectorId: "HYDRATION_VS_ENERGY",
      type: "HYDRATION_VS_ENERGY",
      description: `Your energy averages ${Math.round(highAvg * 10) / 10} on days you drink ${HIGH_HYDRATION}L+ vs ${Math.round(lowAvg * 10) / 10} on days under ${LOW_HYDRATION}L.`,
      domains: ["hydration", "wellbeing"],
      data: {
        high_hydration_energy: Math.round(highAvg * 10) / 10,
        low_hydration_energy: Math.round(lowAvg * 10) / 10,
        delta: Math.round(delta * 10) / 10,
        high_days: highEnergy.length,
        low_days: lowEnergy.length,
      },
      significance,
      effectSize,
    };
  },
});

// ── HYDRATION_VS_MOOD: Water intake → mood ────────────────────────────────────
registerDetector({
  id: "HYDRATION_VS_MOOD",
  name: "Hydration vs mood",
  requiredDomains: ["hydration", "wellbeing"],
  category: "cross",
  detect: (data: UserDataBundle) => {
    const cutoff = format(subDays(new Date(), 30), "yyyy-MM-dd");

    const highMood: number[] = [];
    const lowMood: number[] = [];

    for (const [date, metrics] of data.manualByDateAndMetric) {
      if (date < cutoff) continue;
      const intake = metrics.get("hydration_water_intake");
      if (intake == null) continue;
      const mood = getMood(data, date);
      if (mood == null) continue;

      if (intake >= HIGH_HYDRATION) highMood.push(mood);
      else if (intake < LOW_HYDRATION) lowMood.push(mood);
    }

    if (highMood.length < 3 || lowMood.length < 3) return null;

    const highAvg = mean(highMood);
    const lowAvg = mean(lowMood);
    const delta = highAvg - lowAvg;

    if (Math.abs(delta) < 0.4) return null;

    const effectSize = Math.min(Math.abs(delta) / 10, 1);
    const significance = effectToSignificance(effectSize, { low: 0.04, mid: 0.08, high: 0.12 });

    return {
      detectorId: "HYDRATION_VS_MOOD",
      type: "HYDRATION_VS_MOOD",
      description: `Your mood is ${Math.round(Math.abs(delta) * 10) / 10} points higher on well-hydrated days (${Math.round(highAvg * 10) / 10} vs ${Math.round(lowAvg * 10) / 10}).`,
      domains: ["hydration", "wellbeing"],
      data: {
        high_hydration_mood: Math.round(highAvg * 10) / 10,
        low_hydration_mood: Math.round(lowAvg * 10) / 10,
        delta: Math.round(delta * 10) / 10,
        high_days: highMood.length,
        low_days: lowMood.length,
      },
      significance,
      effectSize,
    };
  },
});
