import type { InsightCategory } from "@/types/index";

/**
 * The six user-facing domains. Every insight maps to one or more.
 * "correlation", "goal", and "general" are NOT domains — they resolve
 * to concrete domains by scanning the insight text.
 */
export type Domain = "sleep" | "fitness" | "chess" | "wellbeing" | "recovery";

export const ALL_DOMAINS: Domain[] = ["sleep", "fitness", "chess", "wellbeing", "recovery"];

/** Keywords that signal a domain when found in title or body text. */
const DOMAIN_KEYWORDS: Record<Domain, RegExp> = {
  sleep:     /\b(sleep|nap|rem|deep sleep|bed\s?time|wake|rested|insomnia|hrs?\s+sleep)\b/i,
  fitness:   /\b(fitness|workout|exercise|run|steps|cardio|vo2|heart rate|training|active minutes|calories burned|distance)\b/i,
  chess:     /\b(chess|elo|rating|accuracy|blitz|rapid|bullet|opening|endgame|game|match|puzzle|lichess|chess\.com)\b/i,
  wellbeing: /\b(wellbeing|well-being|check-?in|mood|stress|mindful|meditation|journal|mental|anxiety|energy level)\b/i,
  recovery:  /\b(recovery|hrv|resting heart|rest day|strain|body battery|readiness|soreness|fatigue)\b/i,
};

/** Direct category-to-domain mapping for categories that ARE domains. */
const CATEGORY_TO_DOMAIN: Partial<Record<InsightCategory, Domain>> = {
  sleep: "sleep",
  fitness: "fitness",
  chess: "chess",
  wellbeing: "wellbeing",
  recovery: "recovery",
};

/**
 * Detect which domains an insight touches.
 *
 * 1. If the category directly maps to a domain, include it.
 * 2. Scan title + body for keyword matches and add those domains.
 * 3. If nothing detected, fall back to the category domain or ["fitness"] as last resort.
 */
export function detectDomains(
  category: InsightCategory,
  title: string,
  body: string,
): Domain[] {
  const found = new Set<Domain>();

  // Step 1: direct category mapping
  const directDomain = CATEGORY_TO_DOMAIN[category];
  if (directDomain) found.add(directDomain);

  // Step 2: keyword scan on combined text
  const text = `${title} ${body}`;
  for (const [domain, regex] of Object.entries(DOMAIN_KEYWORDS)) {
    if (regex.test(text)) found.add(domain as Domain);
  }

  // Step 3: fallback — if still empty, use category mapping or fitness
  if (found.size === 0) {
    if (directDomain) found.add(directDomain);
    else found.add("fitness"); // safe fallback for "general", "goal"
  }

  return ALL_DOMAINS.filter((d) => found.has(d));
}
