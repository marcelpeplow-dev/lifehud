import { registerDetector } from "../detector-registry";
import type { UserDataBundle } from "../data-bundle";
import { mean, effectToSignificance } from "./utils";
import { format, subDays, getDay } from "date-fns";

// ── ALCOHOL_PATTERN: Drinking frequency and pattern ───────────────────────────
registerDetector({
  id: "ALCOHOL_PATTERN",
  name: "Alcohol consumption pattern",
  requiredDomains: ["substances"],
  category: "single",
  detect: (data: UserDataBundle) => {
    const cutoff = format(subDays(new Date(), 30), "yyyy-MM-dd");
    const dayNames = ["Sundays", "Mondays", "Tuesdays", "Wednesdays", "Thursdays", "Fridays", "Saturdays"];

    const drinkDays: { date: string; drinks: number }[] = [];
    for (const [date, metrics] of data.manualByDateAndMetric) {
      if (date < cutoff) continue;
      const drinks = metrics.get("substances_alcohol");
      if (drinks != null && drinks > 0) drinkDays.push({ date, drinks });
    }

    if (drinkDays.length < 7) return null;

    // Total days tracked (need denominator for weekly rate)
    const trackedDates = new Set<string>();
    for (const [date, metrics] of data.manualByDateAndMetric) {
      if (date < cutoff && metrics.has("substances_alcohol")) trackedDates.add(date);
    }
    const totalTrackedDays = trackedDates.size;
    const weeksTracked = Math.max(totalTrackedDays / 7, 1);
    const avgDrinksPerWeek = Math.round((drinkDays.reduce((s, d) => s + d.drinks, 0) / weeksTracked) * 10) / 10;

    // Find heaviest days of week
    const byDow: Record<number, number[]> = {};
    for (const { date, drinks } of drinkDays) {
      const dow = getDay(new Date(date + "T00:00:00"));
      if (!byDow[dow]) byDow[dow] = [];
      byDow[dow].push(drinks);
    }

    const dowAverages = Object.entries(byDow)
      .map(([dow, vals]) => ({ dow: Number(dow), avg: mean(vals), count: vals.length }))
      .filter((d) => d.count >= 2)
      .sort((a, b) => b.avg - a.avg);

    const topDays = dowAverages.slice(0, 2).map((d) => dayNames[d.dow]);

    const effectSize = Math.min(avgDrinksPerWeek / 14, 1); // 14 drinks/week = max
    const significance = effectToSignificance(effectSize, { low: 0.10, mid: 0.20, high: 0.35 });

    const dayPhrase = topDays.length > 0 ? `, mostly on ${topDays.join(" and ")}` : "";

    return {
      detectorId: "ALCOHOL_PATTERN",
      type: "ALCOHOL_PATTERN",
      description: `You average ${avgDrinksPerWeek} drinks per week${dayPhrase}. ${drinkDays.length} drinking days tracked.`,
      domains: ["substances"],
      data: {
        avg_drinks_per_week: avgDrinksPerWeek,
        drinking_days: drinkDays.length,
        top_days: topDays,
        total_tracked_days: totalTrackedDays,
      },
      significance,
      effectSize,
    };
  },
});
