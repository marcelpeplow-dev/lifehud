import { registerDetector } from "../detector-registry";
import type { UserDataBundle } from "../data-bundle";
import { mean, effectToSignificance } from "./utils";
import { format, subDays } from "date-fns";

// ── ALCOHOL_VS_REM: Alcohol → suppressed REM sleep ────────────────────────────
registerDetector({
  id: "ALCOHOL_VS_REM",
  name: "Alcohol vs REM sleep",
  requiredDomains: ["substances", "sleep"],
  category: "cross",
  detect: (data: UserDataBundle) => {
    const cutoff = format(subDays(new Date(), 30), "yyyy-MM-dd");

    const drinkingRem: number[] = [];
    const soberRem: number[] = [];

    for (const [date, metrics] of data.manualByDateAndMetric) {
      if (date < cutoff) continue;
      const drinks = metrics.get("substances_alcohol") ?? 0;
      const sleep = data.sleepByDate.get(date);
      if (sleep == null || sleep.rem_sleep_minutes == null || sleep.duration_minutes == null) continue;
      if (sleep.duration_minutes === 0) continue;

      const remPct = sleep.rem_sleep_minutes / sleep.duration_minutes;
      if (drinks > 0) drinkingRem.push(remPct);
      else soberRem.push(remPct);
    }

    if (drinkingRem.length < 3 || soberRem.length < 3) return null;

    const drinkAvg = mean(drinkingRem);
    const soberAvg = mean(soberRem);
    const delta = soberAvg - drinkAvg; // positive = alcohol suppresses REM

    if (delta < 0.01) return null; // less than 1% difference

    const effectSize = Math.min(delta * 10, 1);
    const significance = effectToSignificance(effectSize, { low: 0.05, mid: 0.15, high: 0.25 });

    return {
      detectorId: "ALCOHOL_VS_REM",
      type: "ALCOHOL_VS_REM",
      description: `On nights you drink, your REM sleep drops from ${Math.round(soberAvg * 100)}% to ${Math.round(drinkAvg * 100)}%. Even 1–2 drinks measurably suppress REM.`,
      domains: ["substances", "sleep"],
      data: {
        drinking_rem_pct: Math.round(drinkAvg * 100),
        sober_rem_pct: Math.round(soberAvg * 100),
        delta_pct: Math.round(delta * 100),
        drinking_nights: drinkingRem.length,
        sober_nights: soberRem.length,
      },
      significance,
      effectSize,
    };
  },
});

// ── ALCOHOL_VS_HRV: Alcohol → suppressed overnight HRV ───────────────────────
registerDetector({
  id: "ALCOHOL_VS_HRV",
  name: "Alcohol vs sleep HRV",
  requiredDomains: ["substances", "sleep"],
  category: "cross",
  detect: (data: UserDataBundle) => {
    const cutoff = format(subDays(new Date(), 30), "yyyy-MM-dd");

    const drinkingHrv: number[] = [];
    const soberHrv: number[] = [];

    for (const [date, metrics] of data.manualByDateAndMetric) {
      if (date < cutoff) continue;
      const drinks = metrics.get("substances_alcohol") ?? 0;
      const sleep = data.sleepByDate.get(date);
      if (sleep == null || sleep.avg_hrv == null) continue;

      if (drinks > 0) drinkingHrv.push(sleep.avg_hrv);
      else soberHrv.push(sleep.avg_hrv);
    }

    if (drinkingHrv.length < 3 || soberHrv.length < 3) return null;

    const drinkAvg = mean(drinkingHrv);
    const soberAvg = mean(soberHrv);
    const delta = soberAvg - drinkAvg; // positive = alcohol suppresses HRV
    const pctDiff = soberAvg > 0 ? delta / soberAvg : 0;

    if (pctDiff < 0.05) return null;

    const effectSize = Math.min(pctDiff * 3, 1);
    const significance = effectToSignificance(effectSize, { low: 0.08, mid: 0.20, high: 0.35 });

    return {
      detectorId: "ALCOHOL_VS_HRV",
      type: "ALCOHOL_VS_HRV",
      description: `Your overnight HRV drops ${Math.round(pctDiff * 100)}% on nights you drink — from ${Math.round(soberAvg)}ms to ${Math.round(drinkAvg)}ms.`,
      domains: ["substances", "sleep"],
      data: {
        drinking_hrv_ms: Math.round(drinkAvg),
        sober_hrv_ms: Math.round(soberAvg),
        delta_ms: Math.round(delta),
        pct_drop: Math.round(pctDiff * 100),
        drinking_nights: drinkingHrv.length,
        sober_nights: soberHrv.length,
      },
      significance,
      effectSize,
    };
  },
});

// ── ALCOHOL_VS_NEXT_DAY: Drinking → next-day energy and chess accuracy ────────
registerDetector({
  id: "ALCOHOL_VS_NEXT_DAY",
  name: "Alcohol vs next-day performance",
  requiredDomains: ["substances"],
  category: "cross",
  detect: (data: UserDataBundle) => {
    const cutoff = format(subDays(new Date(), 30), "yyyy-MM-dd");

    const drinkingNextEnergy: number[] = [];
    const soberNextEnergy: number[] = [];
    const drinkingNextAccuracy: number[] = [];
    const soberNextAccuracy: number[] = [];

    const hasWellbeing = data.activeDomains.has("wellbeing");
    const hasChess = data.activeDomains.has("chess");

    if (!hasWellbeing && !hasChess) return null;

    for (const [date, metrics] of data.manualByDateAndMetric) {
      if (date < cutoff) continue;
      const drinks = metrics.get("substances_alcohol");
      if (drinks == null) continue;

      // Get next day
      const nextDate = format(subDays(new Date(date + "T12:00:00"), -1), "yyyy-MM-dd");

      if (hasWellbeing) {
        // Try manual entries first, then checkins
        const nextManual = data.manualByDateAndMetric.get(nextDate);
        const nextEnergy = nextManual?.get("wellbeing_energy") ??
          data.checkinByDate.get(nextDate)?.energy;
        if (nextEnergy != null) {
          if (drinks > 0) drinkingNextEnergy.push(nextEnergy);
          else soberNextEnergy.push(nextEnergy);
        }
      }

      if (hasChess) {
        const nextGames = data.chessByDate.get(nextDate) ?? [];
        const accuracies = nextGames.map((g) => g.accuracy).filter((a): a is number => a != null);
        if (accuracies.length > 0) {
          const avgAcc = mean(accuracies);
          if (drinks > 0) drinkingNextAccuracy.push(avgAcc);
          else soberNextAccuracy.push(avgAcc);
        }
      }
    }

    const hasEnoughEnergy = drinkingNextEnergy.length >= 3 && soberNextEnergy.length >= 3;
    const hasEnoughChess = drinkingNextAccuracy.length >= 3 && soberNextAccuracy.length >= 3;

    if (!hasEnoughEnergy && !hasEnoughChess) return null;

    const energyDelta = hasEnoughEnergy ? mean(soberNextEnergy) - mean(drinkingNextEnergy) : 0;
    const accDelta = hasEnoughChess ? mean(soberNextAccuracy) - mean(drinkingNextAccuracy) : 0;

    if (energyDelta < 0.5 && accDelta < 3) return null;

    const parts: string[] = [];
    if (hasEnoughEnergy && energyDelta >= 0.5) {
      const drinkE = Math.round(mean(drinkingNextEnergy) * 10) / 10;
      const soberE = Math.round(mean(soberNextEnergy) * 10) / 10;
      parts.push(`your next-day energy drops from ${soberE} to ${drinkE}`);
    }
    if (hasEnoughChess && accDelta >= 3) {
      const drinkA = Math.round(mean(drinkingNextAccuracy));
      const soberA = Math.round(mean(soberNextAccuracy));
      parts.push(`your chess accuracy falls ${Math.round(accDelta)}% (${drinkA}% vs ${soberA}%)`);
    }

    if (parts.length === 0) return null;

    const effectSize = Math.min(Math.max(energyDelta / 10, accDelta / 100) * 3, 1);
    const significance = effectToSignificance(effectSize, { low: 0.08, mid: 0.20, high: 0.35 });

    return {
      detectorId: "ALCOHOL_VS_NEXT_DAY",
      type: "ALCOHOL_VS_NEXT_DAY",
      description: `After drinking nights, ${parts.join(" and ")}.`,
      domains: hasChess ? ["substances", "chess"] : ["substances"],
      data: {
        drinking_next_energy: hasEnoughEnergy ? Math.round(mean(drinkingNextEnergy) * 10) / 10 : null,
        sober_next_energy: hasEnoughEnergy ? Math.round(mean(soberNextEnergy) * 10) / 10 : null,
        energy_delta: hasEnoughEnergy ? Math.round(energyDelta * 10) / 10 : null,
        drinking_next_accuracy: hasEnoughChess ? Math.round(mean(drinkingNextAccuracy)) : null,
        sober_next_accuracy: hasEnoughChess ? Math.round(mean(soberNextAccuracy)) : null,
        accuracy_delta: hasEnoughChess ? Math.round(accDelta) : null,
      },
      significance,
      effectSize,
    };
  },
});
