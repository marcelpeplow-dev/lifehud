import { format, subDays } from "date-fns";
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
