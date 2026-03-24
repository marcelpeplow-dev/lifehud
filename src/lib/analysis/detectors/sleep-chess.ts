import { format, parseISO, subDays } from "date-fns";
import { registerDetector } from "../detector-registry";
import type { UserDataBundle } from "../data-bundle";
import { mean, winRate, avgAccuracy, effectToSignificance } from "./utils";

// ── CHESS_SLEEP_CORRELATION: Sleep duration → chess performance ───────────────
registerDetector({
  id: "CHESS_SLEEP_CORRELATION",
  name: "Sleep vs chess performance",
  requiredDomains: ["chess", "sleep"],
  category: "cross",
  detect: (data: UserDataBundle) => {
    const cutoff = format(subDays(new Date(), 30), "yyyy-MM-dd");
    const recent30 = data.chessGames.filter((g) => g.date >= cutoff);

    const afterGoodSleep = recent30.filter((g) => {
      const prevDate = format(subDays(new Date(g.date), 1), "yyyy-MM-dd");
      const sleep = data.sleepByDate.get(prevDate)?.duration_minutes;
      return sleep != null && sleep >= 420;
    });
    const afterPoorSleep = recent30.filter((g) => {
      const prevDate = format(subDays(new Date(g.date), 1), "yyyy-MM-dd");
      const sleep = data.sleepByDate.get(prevDate)?.duration_minutes;
      return sleep != null && sleep < 360;
    });

    if (afterGoodSleep.length < 3 || afterPoorSleep.length < 3) return null;

    const goodWR = Math.round(winRate(afterGoodSleep) * 100);
    const poorWR = Math.round(winRate(afterPoorSleep) * 100);
    const wrDelta = goodWR - poorWR;

    const goodAcc = avgAccuracy(afterGoodSleep);
    const poorAcc = avgAccuracy(afterPoorSleep);
    const accDelta =
      goodAcc !== null && poorAcc !== null
        ? Math.round(goodAcc - poorAcc)
        : null;

    if (
      Math.abs(wrDelta) < 8 &&
      (accDelta === null || Math.abs(accDelta) < 5)
    )
      return null;

    const parts: string[] = [];
    if (Math.abs(wrDelta) >= 5)
      parts.push(
        `win rate is ${wrDelta > 0 ? wrDelta : Math.abs(wrDelta)}% ${wrDelta > 0 ? "higher" : "lower"} (${goodWR}% vs ${poorWR}%)`,
      );
    if (accDelta !== null && Math.abs(accDelta) >= 3)
      parts.push(
        `accuracy is ${accDelta > 0 ? accDelta : Math.abs(accDelta)}% ${accDelta > 0 ? "higher" : "lower"} (${Math.round(goodAcc!)}% vs ${Math.round(poorAcc!)}%)`,
      );

    const effectSize = Math.abs(wrDelta) / 100;
    return {
      detectorId: "CHESS_SLEEP_CORRELATION",
      type: "chess_sleep_correlation",
      description: `After 7+ hours of sleep, your chess ${parts.join(" and ")} compared to nights under 6 hours. ${afterGoodSleep.length + afterPoorSleep.length} games analyzed.`,
      domains: ["chess", "sleep"],
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
      significance: effectToSignificance(effectSize, { low: 0.08, mid: 0.12, high: 0.18 }),
      effectSize,
    };
  },
});

// ── SLEEP_DURATION_VS_CHESS_ACCURACY: Bucket games by prior night's sleep ─────
registerDetector({
  id: "SLEEP_DURATION_VS_CHESS_ACCURACY",
  name: "Sleep duration vs chess accuracy",
  requiredDomains: ["chess", "sleep"],
  category: "cross",
  detect: (data: UserDataBundle) => {
    const buckets: Record<string, number[]> = {
      "<6h": [],
      "6-7h": [],
      "7-8h": [],
      "8+h": [],
    };

    for (const g of data.chessGames) {
      if (g.accuracy === null) continue;
      const prevDate = format(subDays(new Date(g.date), 1), "yyyy-MM-dd");
      const sleep = data.sleepByDate.get(prevDate);
      if (!sleep || sleep.duration_minutes == null) continue;

      const hours = sleep.duration_minutes / 60;
      if (hours < 6) buckets["<6h"].push(g.accuracy);
      else if (hours < 7) buckets["6-7h"].push(g.accuracy);
      else if (hours < 8) buckets["7-8h"].push(g.accuracy);
      else buckets["8+h"].push(g.accuracy);
    }

    const totalPoints = Object.values(buckets).reduce((s, b) => s + b.length, 0);
    if (totalPoints < 7) return null;

    const bucketAvgs: Record<string, number | null> = {};
    for (const [key, vals] of Object.entries(buckets)) {
      bucketAvgs[key] = vals.length > 0 ? mean(vals) : null;
    }

    const shortSleepAcc = bucketAvgs["<6h"] ?? bucketAvgs["6-7h"];
    const longSleepAcc = bucketAvgs["8+h"] ?? bucketAvgs["7-8h"];
    if (shortSleepAcc === null || longSleepAcc === null) return null;

    const accDelta = Math.round(longSleepAcc - shortSleepAcc);
    if (Math.abs(accDelta) < 3) return null;

    const effectSize = Math.abs(accDelta) / 100;
    return {
      detectorId: "SLEEP_DURATION_VS_CHESS_ACCURACY",
      type: "sleep_duration_vs_chess_accuracy",
      description: `Your chess accuracy is ${Math.abs(accDelta)}% ${accDelta > 0 ? "higher" : "lower"} on days you sleep more than 7 hours.`,
      domains: ["chess", "sleep"],
      data: {
        bucket_avgs: bucketAvgs,
        bucket_counts: Object.fromEntries(
          Object.entries(buckets).map(([k, v]) => [k, v.length]),
        ),
        accuracy_delta: accDelta,
        effectSize,
      },
      significance: effectToSignificance(effectSize, { low: 0.05, mid: 0.10, high: 0.15 }),
      effectSize,
    };
  },
});

// ── SLEEP_QUALITY_VS_CHESS_WIN_RATE: Good sleep vs poor sleep win rate ─────────
registerDetector({
  id: "SLEEP_QUALITY_VS_CHESS_WIN_RATE",
  name: "Sleep quality vs chess win rate",
  requiredDomains: ["chess", "sleep"],
  category: "cross",
  detect: (data: UserDataBundle) => {
    const afterGoodSleep: { result: string }[] = [];
    const afterPoorSleep: { result: string }[] = [];

    for (const g of data.chessGames) {
      const prevDate = format(subDays(new Date(g.date), 1), "yyyy-MM-dd");
      const sleep = data.sleepByDate.get(prevDate);
      if (!sleep || sleep.sleep_score === null) continue;

      if (sleep.sleep_score > 75) afterGoodSleep.push(g);
      else if (sleep.sleep_score < 60) afterPoorSleep.push(g);
    }

    if (afterGoodSleep.length + afterPoorSleep.length < 7) return null;
    if (afterGoodSleep.length < 3 || afterPoorSleep.length < 3) return null;

    const goodWR = Math.round(winRate(afterGoodSleep) * 100);
    const poorWR = Math.round(winRate(afterPoorSleep) * 100);
    const wrDelta = goodWR - poorWR;

    if (Math.abs(wrDelta) < 5) return null;

    const effectSize = Math.abs(wrDelta) / 100;
    return {
      detectorId: "SLEEP_QUALITY_VS_CHESS_WIN_RATE",
      type: "sleep_quality_vs_chess_win_rate",
      description: `Your chess win rate is ${goodWR}% after good sleep vs ${poorWR}% after poor sleep.`,
      domains: ["chess", "sleep"],
      data: {
        good_sleep_wr: goodWR,
        poor_sleep_wr: poorWR,
        wr_delta: wrDelta,
        good_sleep_games: afterGoodSleep.length,
        poor_sleep_games: afterPoorSleep.length,
        effectSize,
      },
      significance: effectToSignificance(effectSize, { low: 0.08, mid: 0.15, high: 0.20 }),
      effectSize,
    };
  },
});

// ── LATE_NIGHT_CHESS_VS_NEXT_SLEEP: Chess after 10pm → sleep impact ───────────
registerDetector({
  id: "LATE_NIGHT_CHESS_VS_NEXT_SLEEP",
  name: "Late night chess vs next sleep",
  requiredDomains: ["chess", "sleep"],
  category: "cross",
  detect: (data: UserDataBundle) => {
    const lateNightDates = new Set<string>();

    for (const g of data.chessGames) {
      if (parseISO(g.played_at).getHours() >= 22) {
        lateNightDates.add(g.date);
      }
    }

    const lateNightSleep: { duration: number; deep: number }[] = [];
    const normalNightSleep: { duration: number; deep: number }[] = [];

    for (const [date, sleep] of data.sleepByDate) {
      if (sleep.deep_sleep_minutes == null || sleep.duration_minutes == null) continue;
      if (lateNightDates.has(date)) {
        lateNightSleep.push({ duration: sleep.duration_minutes, deep: sleep.deep_sleep_minutes });
      } else {
        normalNightSleep.push({ duration: sleep.duration_minutes, deep: sleep.deep_sleep_minutes });
      }
    }

    if (lateNightSleep.length + normalNightSleep.length < 7) return null;
    if (lateNightSleep.length < 3 || normalNightSleep.length < 3) return null;

    const lateAvgDuration = mean(lateNightSleep.map((s) => s.duration));
    const normalAvgDuration = mean(normalNightSleep.map((s) => s.duration));
    const durationDelta = Math.round(normalAvgDuration - lateAvgDuration);

    const lateAvgDeep = mean(lateNightSleep.map((s) => s.deep));
    const normalAvgDeep = mean(normalNightSleep.map((s) => s.deep));
    const deepDelta = Math.round(normalAvgDeep - lateAvgDeep);

    if (Math.abs(durationDelta) < 10 && Math.abs(deepDelta) < 5) return null;

    const parts: string[] = [];
    if (Math.abs(durationDelta) >= 10) {
      parts.push(
        `you fall asleep ${Math.abs(durationDelta)} minutes ${durationDelta > 0 ? "later" : "earlier"}`,
      );
    }
    if (Math.abs(deepDelta) >= 5) {
      parts.push(
        `${deepDelta > 0 ? "lose" : "gain"} ${Math.abs(deepDelta)} minutes of deep sleep`,
      );
    }

    const effectSize = Math.abs(durationDelta) / 60;
    return {
      detectorId: "LATE_NIGHT_CHESS_VS_NEXT_SLEEP",
      type: "late_night_chess_vs_next_sleep",
      description: `On nights you play chess past 10pm, ${parts.join(" and ")}.`,
      domains: ["chess", "sleep"],
      data: {
        late_night_games: lateNightDates.size,
        late_avg_duration: Math.round(lateAvgDuration),
        normal_avg_duration: Math.round(normalAvgDuration),
        duration_delta: durationDelta,
        late_avg_deep: Math.round(lateAvgDeep),
        normal_avg_deep: Math.round(normalAvgDeep),
        deep_delta: deepDelta,
        effectSize,
      },
      significance: effectToSignificance(effectSize, { low: 0.10, mid: 0.25, high: 0.40 }),
      effectSize,
    };
  },
});
