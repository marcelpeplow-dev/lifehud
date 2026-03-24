import { registerDetector } from "../detector-registry";
import type { UserDataBundle } from "../data-bundle";
import { mean } from "./utils";

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
