import { NextResponse } from "next/server";
import { format, subDays } from "date-fns";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/server";
import { discoverActiveDomains } from "@/lib/analysis/domains";
import { buildUserDataBundle } from "@/lib/analysis/data-bundle";
import { getApplicableDetectors } from "@/lib/analysis/detector-registry";
import type { DetectedPattern } from "@/lib/analysis/detector-registry";
import { scoreAndBudget, type ScoredPattern } from "@/lib/analysis/pattern-scorer";
import { generateInsights, generateDailyAction } from "@/lib/ai/generate";
import { average } from "@/lib/utils/metrics";
import type { InsightCategory } from "@/types/index";

// Import all detectors to register them
import "@/lib/analysis/detectors";

export const GET = POST;

export async function POST() {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const today = new Date();
    const todayStr = format(today, "yyyy-MM-dd");

    // Check for already-generated insights today
    const { data: existingToday } = await supabase
      .from("insights")
      .select("id")
      .eq("user_id", user.id)
      .eq("date", todayStr)
      .limit(1);

    if (existingToday && existingToday.length > 0) {
      return NextResponse.json({ message: "Insights already generated today", generated: 0 });
    }

    // ── Stage 1: Domain discovery ──────────────────────────────────────────
    const { activeDomains, dataCounts } = await discoverActiveDomains(user.id, supabase);

    if (activeDomains.size === 0) {
      return NextResponse.json({ message: "Not enough data for any domain (need 7+ days)", generated: 0 });
    }

    // ── Stage 2-3: Build data bundle and run detectors ─────────────────────
    const bundle = await buildUserDataBundle(user.id, activeDomains, supabase);
    const detectors = getApplicableDetectors(activeDomains);

    const allPatterns: DetectedPattern[] = [];
    for (const detector of detectors) {
      try {
        const result = detector.detect(bundle);
        if (result) allPatterns.push(result);
      } catch (err) {
        console.warn(`[Insight Gen] Detector ${detector.id} failed:`, err);
      }
    }

    if (allPatterns.length === 0) {
      return NextResponse.json({ message: "No patterns detected across active domains", generated: 0 });
    }

    // ── Stage 4: Score and budget ──────────────────────────────────────────
    const budgeted = scoreAndBudget(allPatterns, bundle.recentInsights, activeDomains);

    // ── Logging ────────────────────────────────────────────────────────────
    const domainList = Array.from(activeDomains).join(", ");
    console.log(
      `[Insight Gen] User ${user.id.slice(0, 8)}...\n` +
      `  Active domains: ${domainList}\n` +
      `  Data counts: ${JSON.stringify(dataCounts)}\n` +
      `  Detectors run: ${detectors.length}\n` +
      `  Patterns detected: ${allPatterns.length}\n` +
      `  Budget: ${budgeted.length}\n` +
      `  Selected: ${budgeted.map((p) => `${p.detectorId} (${p.finalScore.toFixed(2)})`).join(", ")}`,
    );

    // ── Stage 5: Generate insights via Claude ──────────────────────────────
    const rawInsights = await generateInsights(budgeted, bundle, activeDomains);

    // Log results
    const rarityCounts: Record<string, number> = {};
    for (const ins of rawInsights) {
      rarityCounts[ins.rarity] = (rarityCounts[ins.rarity] ?? 0) + 1;
    }
    const rarityStr = Object.entries(rarityCounts)
      .map(([r, c]) => `${c} ${r[0].toUpperCase() + r.slice(1)}`)
      .join(", ");
    console.log(`  Generated: ${rawInsights.length} insights (${rarityStr})`);

    // Insert into DB with detector metadata
    const rows = rawInsights.map((insight) => ({
      user_id: user.id,
      date: todayStr,
      category: insight.category as InsightCategory,
      title: insight.title,
      body: insight.body,
      priority: insight.priority,
      rarity: insight.rarity,
      data_points: {
        detectorId: budgeted[0]?.detectorId ?? null,
        patterns_used: budgeted.map((p) => p.detectorId),
        domains: Array.from(activeDomains),
        confidence: insight.confidence,
      },
      is_read: false,
      is_dismissed: false,
    }));

    const { data: inserted, error } = await supabase.from("insights").insert(rows).select();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    // Generate daily action (non-blocking)
    try {
      const sevenDaysAgo = format(subDays(today, 7), "yyyy-MM-dd");
      const recentWorkouts = bundle.workouts.filter((w) => w.date >= sevenDaysAgo);
      const last7Checkins = bundle.checkins.filter((c) => c.date >= sevenDaysAgo);
      const avgSleepMinutes = average(bundle.sleepRecords.map((s) => s.duration_minutes));
      const lastNight = bundle.sleepRecords.at(-1);

      const actionText = await generateDailyAction({
        lastNightSleepHours: lastNight?.duration_minutes != null ? lastNight.duration_minutes / 60 : null,
        avgSleepHours: avgSleepMinutes != null ? avgSleepMinutes / 60 : null,
        recentWorkoutCount: recentWorkouts.length,
        lastWorkoutDate: bundle.workouts.at(-1)?.date ?? null,
        avgMood: last7Checkins.length > 0 ? average(last7Checkins.map((c) => c.mood)) : null,
        avgEnergy: last7Checkins.length > 0 ? average(last7Checkins.map((c) => c.energy)) : null,
        avgStress: last7Checkins.length > 0 ? average(last7Checkins.map((c) => c.stress)) : null,
        topPattern: budgeted[0]?.description ?? null,
      });

      if (actionText) {
        const serviceClient = createServiceClient();
        await serviceClient.from("daily_actions").upsert({
          user_id: user.id,
          date: todayStr,
          text: actionText,
        }, { onConflict: "user_id,date" });
      }
    } catch {
      // Daily action failure is non-fatal
    }

    return NextResponse.json({ generated: inserted?.length ?? 0, insights: inserted });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("[Insight Gen] Error:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
