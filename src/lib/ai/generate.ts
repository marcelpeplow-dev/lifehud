import Anthropic from "@anthropic-ai/sdk";
import type { DetectedPattern, RawInsight } from "@/types/index";

const MODEL = "claude-sonnet-4-6";

const SYSTEM_PROMPT = `You are a precision health analytics engine classifying and generating insights for a personal fitness dashboard.

RARITY TIERS — assign one to every insight:
- "common": Single metric restated with no analysis. ("Your average sleep was 7.1h." "Resting HR is 58 bpm.") Basic, everyone can see this in their wearable app.
- "uncommon": Single-domain trend that requires pattern detection. ("Your bedtime has drifted 35 minutes later over 2 weeks.") One data source, some analysis required.
- "rare": Two health domains correlated, medium confidence. Insight crosses domains. Actionable but not ultra-specific.
- "epic": Two or more domains, high confidence, with a specific time-bound actionable recommendation for today or this week.
- "legendary": Multiple simultaneous cross-domain correlations, high statistical significance, would be genuinely hard to discover without this platform. Rare — maybe 1 in 10 generations should produce one.

RARITY RULES:
- "speculative" confidence → maximum rarity is "rare"
- "medium" confidence → maximum rarity is "epic"
- "high" confidence → can be "legendary" if the insight crosses 3+ domains or is highly non-obvious
- Single-domain patterns → max "uncommon"
- Never assign "legendary" unless the insight is truly multi-domain with strong evidence

CONTENT RULES:
- Every "epic" or "legendary" insight MUST include a specific, time-bound actionable recommendation (not "try sleeping more" — but "aim to be in bed by 10:20pm tonight")
- Cite actual numbers from the pattern data
- Write in second person, present tense, as a direct coach
- Keep body text under 300 characters

Output: valid JSON array only. No markdown, no text outside the JSON.
Schema: [{"category": "sleep|fitness|recovery|correlation|wellbeing|goal|general", "title": "max 60 chars", "body": "max 300 chars", "priority": 1-5, "confidence": "high|medium|speculative", "rarity": "common|uncommon|rare|epic|legendary"}]`;

const DAILY_ACTION_PROMPT = `You are a personal health coach. Based on the data below, give ONE specific, direct recommendation for today — written as a coach talking directly to the user.

Rules:
- Must reference specific numbers
- Must connect two data domains (sleep + workout, stress + exercise, etc.)
- Be urgent and specific to today/tonight
- Sound like a coach, not a data report
- Maximum 2 sentences
- Do NOT start with "You" as the very first word — vary the opening

Return ONLY the message text. No quotes, no prefix, no JSON.`;

export async function generateInsights(
  patterns: DetectedPattern[],
  basicStats: DetectedPattern[],
  context: {
    nightCount: number;
    workoutCount: number;
    avgSleepHours: number | null;
    avgDeepRemPct: number | null;
    lastNightSleepHours: number | null;
    checkInCount: number;
    avgMood: number | null;
    avgEnergy: number | null;
    avgStress: number | null;
  }
): Promise<RawInsight[]> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error("ANTHROPIC_API_KEY is not set");

  const client = new Anthropic({ apiKey });

  const contextLines = [
    `30-day summary: ${context.nightCount} nights tracked, ${context.workoutCount} workouts`,
    `Avg sleep: ${context.avgSleepHours != null ? context.avgSleepHours.toFixed(1) + "h" : "unknown"}${context.avgDeepRemPct != null ? ` (${Math.round(context.avgDeepRemPct * 100)}% deep+REM)` : ""}`,
    context.lastNightSleepHours != null
      ? `Last night: ${context.lastNightSleepHours.toFixed(1)}h`
      : null,
    context.checkInCount > 0
      ? `Check-ins (${context.checkInCount}): avg mood ${context.avgMood?.toFixed(1)}/10, energy ${context.avgEnergy?.toFixed(1)}/10, stress ${context.avgStress?.toFixed(1)}/10`
      : "No check-in data.",
  ]
    .filter(Boolean)
    .join(". ");

  const allPatterns = [
    ...patterns.map((p) => ({ ...p, tier: "cross_domain" })),
    ...basicStats.map((p) => ({ ...p, tier: "basic" })),
  ];

  const userMessage = `Context: ${contextLines}

Patterns (${allPatterns.length} total):
${allPatterns.map((p, i) => `${i + 1}. [${p.significance.toUpperCase()}][${p.tier}] ${p.description}\n   Data: ${JSON.stringify(p.data)}`).join("\n")}

Generate insights for ALL patterns above. Cross-domain patterns should be Rare/Epic/Legendary. Basic/stat patterns should be Common/Uncommon. Include 2-4 cross-domain insights and 2-3 common stat summaries.`.trim();

  const message = await client.messages.create({
    model: MODEL,
    max_tokens: 2048,
    system: SYSTEM_PROMPT,
    messages: [{ role: "user", content: userMessage }],
  });

  const text = message.content.find((b) => b.type === "text")?.text ?? "[]";
  const cleaned = text.replace(/^```(?:json)?\n?/i, "").replace(/\n?```$/i, "").trim();
  const parsed = JSON.parse(cleaned);
  if (!Array.isArray(parsed)) throw new Error("Claude did not return an array");

  const validRarities = new Set(["common", "uncommon", "rare", "epic", "legendary"]);
  const validConfidences = new Set(["high", "medium", "speculative"]);

  return parsed.map((item: Record<string, unknown>) => ({
    category: String(item.category ?? "general"),
    title: String(item.title ?? "Insight"),
    body: String(item.body ?? ""),
    priority: Math.min(5, Math.max(1, Number(item.priority ?? 3))),
    confidence: (validConfidences.has(String(item.confidence)) ? item.confidence : "medium") as "high" | "medium" | "speculative",
    rarity: (validRarities.has(String(item.rarity)) ? item.rarity : "common") as import("@/types/index").InsightRarity,
  })) as RawInsight[];
}

export async function generateDailyAction(context: {
  lastNightSleepHours: number | null;
  avgSleepHours: number | null;
  recentWorkoutCount: number;
  lastWorkoutDate: string | null;
  avgMood: number | null;
  avgEnergy: number | null;
  avgStress: number | null;
  topPattern: string | null;
}): Promise<string> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error("ANTHROPIC_API_KEY is not set");

  const client = new Anthropic({ apiKey });

  const lines = [
    context.lastNightSleepHours != null ? `Last night's sleep: ${context.lastNightSleepHours.toFixed(1)}h (your avg: ${context.avgSleepHours?.toFixed(1) ?? "unknown"}h)` : null,
    `Workouts last 7 days: ${context.recentWorkoutCount}`,
    context.lastWorkoutDate ? `Last workout: ${context.lastWorkoutDate}` : "No recent workouts",
    context.avgMood != null ? `Avg mood/energy/stress (last 7 days): ${context.avgMood.toFixed(1)} / ${context.avgEnergy?.toFixed(1)} / ${context.avgStress?.toFixed(1)}` : null,
    context.topPattern ? `Top detected pattern: ${context.topPattern}` : null,
  ].filter(Boolean).join("\n");

  const message = await client.messages.create({
    model: MODEL,
    max_tokens: 200,
    system: DAILY_ACTION_PROMPT,
    messages: [{ role: "user", content: lines }],
  });

  return message.content.find((b) => b.type === "text")?.text?.trim() ?? "";
}
