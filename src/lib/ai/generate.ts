import Anthropic from "@anthropic-ai/sdk";
import type { DetectedPattern, RawInsight } from "@/types/index";

const MODEL = "claude-sonnet-4-6";

const SYSTEM_PROMPT = `You are a precision health analytics engine generating insights for a personal fitness dashboard.

HARD RULES — follow every one exactly:
1. Every insight MUST connect at least two health domains (sleep + workout performance, stress + sleep quality, exercise + recovery, mood + training, bedtime timing + next-day energy). A single-metric observation ("your average sleep is 7.1h" or "your resting HR is trending down") is forbidden — wearable apps already display those stats.
2. Every insight MUST include a specific, actionable recommendation tied to today or the near future. Not "try to sleep more" — but "Your data shows your sweet spot is 7.5h. To hit that tonight, be in bed by 10:20pm."
3. Generate FEWER insights rather than padding. If you have 2 strong patterns, write 2 insights. Do not pad to 3.
4. Write as a sharp, direct coach — second person, present tense. No hedging like "it seems" or "you might want to consider."
5. Cite actual numbers from the pattern data in every insight.

Confidence levels:
- "high": clear, consistent signal across 8+ data points
- "medium": observed in 4–7 data points, moderately consistent
- "speculative": fewer than 4 data points or noisy signal — still worth sharing, but flag it

Output: valid JSON array only. No markdown, no text outside the JSON.
Schema: [{"category": "sleep|fitness|recovery|correlation|wellbeing|goal|general", "title": "max 60 chars", "body": "max 300 chars — must include the specific cross-domain finding AND a specific actionable recommendation", "priority": 1-5, "confidence": "high|medium|speculative"}]`;

export async function generateInsights(
  patterns: DetectedPattern[],
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

  const userMessage = `Context (use for numbers in recommendations, not as insight topics): ${contextLines}

Cross-domain patterns detected (${patterns.length}):
${patterns.map((p, i) => `${i + 1}. [${p.significance.toUpperCase()}] ${p.description}\n   Data: ${JSON.stringify(p.data)}`).join("\n")}

Generate insights based strictly on the cross-domain patterns above. Do not create insights about data not listed here.`.trim();

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

  return parsed.map((item: Record<string, unknown>) => ({
    category: String(item.category ?? "general"),
    title: String(item.title ?? "Insight"),
    body: String(item.body ?? ""),
    priority: Math.min(5, Math.max(1, Number(item.priority ?? 3))),
    confidence: (["high", "medium", "speculative"].includes(String(item.confidence))
      ? item.confidence
      : "medium") as "high" | "medium" | "speculative",
  })) as RawInsight[];
}
