import type { DetectedPattern } from "./detector-registry";
import type { Domain } from "./domains";
import type { Insight } from "@/types/index";
import { differenceInDays } from "date-fns";

export interface ScoredPattern extends DetectedPattern {
  noveltyScore: number;
  domainBonus: number;
  finalScore: number;
}

/**
 * Compute how many patterns to send to Claude based on active domain count.
 */
function computeBudget(activeDomainCount: number, maxOverride?: number): number {
  if (maxOverride != null) return maxOverride;
  if (activeDomainCount >= 4) return 12;
  if (activeDomainCount === 3) return 10;
  if (activeDomainCount === 2) return 8;
  return 6;
}

/**
 * Compute novelty score for a detector based on how recently it generated an insight.
 *
 * 1.0 — never generated
 * 0.7 — last generated 7+ days ago
 * 0.4 — last generated 3-7 days ago
 * 0.1 — last generated within 3 days
 */
function computeNovelty(detectorId: string, recentInsights: Insight[]): number {
  let mostRecentDays = Infinity;

  const now = new Date();
  for (const ins of recentInsights) {
    const dp = ins.data_points as Record<string, unknown> | null;
    if (!dp) continue;

    // Check detectorId field
    if (dp.detectorId === detectorId) {
      const days = differenceInDays(now, new Date(ins.created_at));
      if (days < mostRecentDays) mostRecentDays = days;
    }

    // Also check patterns_used array
    const patternsUsed = dp.patterns_used;
    if (Array.isArray(patternsUsed) && patternsUsed.includes(detectorId)) {
      const days = differenceInDays(now, new Date(ins.created_at));
      if (days < mostRecentDays) mostRecentDays = days;
    }
  }

  if (mostRecentDays === Infinity) return 1.0;
  if (mostRecentDays >= 7) return 0.7;
  if (mostRecentDays >= 3) return 0.4;
  return 0.1;
}

/**
 * Score all detected patterns and select the top N for the AI prompt.
 *
 * Ensures every active domain gets at least one representative pattern (reserved slots),
 * then fills remaining slots with highest-scored patterns regardless of domain.
 */
export function scoreAndBudget(
  patterns: DetectedPattern[],
  recentInsights: Insight[],
  activeDomains: Set<Domain>,
  maxPatterns?: number,
): ScoredPattern[] {
  const budget = computeBudget(activeDomains.size, maxPatterns);

  // Step 1: Score every pattern
  const scored: ScoredPattern[] = patterns.map((p) => {
    const noveltyScore = computeNovelty(p.detectorId, recentInsights);
    const domainCount = p.domains.length;
    const domainBonus = domainCount >= 3 ? 2.0 : domainCount === 2 ? 1.5 : 1.0;
    const finalScore = p.significance * noveltyScore * domainBonus;

    return { ...p, noveltyScore, domainBonus, finalScore };
  });

  // Sort by finalScore descending
  scored.sort((a, b) => b.finalScore - a.finalScore);

  // Step 2: Deduplicate — keep only the highest-scoring pattern per detectorId
  const seenDetectors = new Set<string>();
  const deduped: ScoredPattern[] = [];
  for (const p of scored) {
    if (seenDetectors.has(p.detectorId)) continue;
    seenDetectors.add(p.detectorId);
    deduped.push(p);
  }

  // Step 3: Reserve slots — guarantee each active domain has representation
  const selected = new Set<string>(); // detectorIds
  const reserved: ScoredPattern[] = [];

  for (const domain of activeDomains) {
    const best = deduped.find(
      (p) => !selected.has(p.detectorId) && p.domains.includes(domain),
    );
    if (best) {
      reserved.push(best);
      selected.add(best.detectorId);
    }
  }

  // Step 4: Fill remaining slots with highest finalScore not already selected
  const remaining: ScoredPattern[] = [];
  for (const p of deduped) {
    if (selected.has(p.detectorId)) continue;
    remaining.push(p);
    selected.add(p.detectorId);
    if (reserved.length + remaining.length >= budget) break;
  }

  // Combine and sort by finalScore
  const result = [...reserved, ...remaining];
  result.sort((a, b) => b.finalScore - a.finalScore);
  return result.slice(0, budget);
}
