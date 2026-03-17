import Anthropic from "@anthropic-ai/sdk";
import type { DetectedPattern, RawInsight } from "@/types/index";

const MODEL = "claude-sonnet-4-5";

const SYSTEM_PROMPT = `You are a personal health and fitness coach analyzing biometric data from a wearable device.
Generate 2-3 concise, actionable, personalized insights based on detected patterns in the user's data.

Rules:
- Be specific and cite the actual numbers from the data
- Be encouraging, not alarmist
- Focus on what the user can do differently
- Each insight should be a distinct observation
- Vary insight categories (sleep, fitness, recovery, correlation)

Respond ONLY with a valid JSON array. No markdown, no explanation outside the JSON.
Schema: [{"category": "sleep|fitness|recovery|correlation|goal|general", "title": "short title (max 60 chars)", "body": "2-3 sentence insight (max 200 chars)", "priority": 1-5}]`;

export async function generateInsights(
  patterns: DetectedPattern[],
  context: { nightCount: number; workoutCount: number; avgSleepHours: number | null }
): Promise<RawInsight[]> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error("ANTHROPIC_API_KEY is not set");

  const client = new Anthropic({ apiKey });

  const userMessage = `
User context: ${context.nightCount} nights tracked, ${context.workoutCount} workouts in last 30 days, avg sleep ${context.avgSleepHours != null ? context.avgSleepHours.toFixed(1) + "h" : "unknown"}.

Detected patterns (${patterns.length}):
${patterns.map((p, i) => `${i + 1}. [${p.significance.toUpperCase()}] ${p.description}`).join("\n")}

Generate 2-3 personalized insights.`.trim();

  const message = await client.messages.create({
    model: MODEL,
    max_tokens: 1024,
    system: SYSTEM_PROMPT,
    messages: [{ role: "user", content: userMessage }],
  });

  const text = message.content.find((b) => b.type === "text")?.text ?? "[]";

  // Strip markdown code fences if present
  const cleaned = text.replace(/^```(?:json)?\n?/i, "").replace(/\n?```$/i, "").trim();

  const parsed = JSON.parse(cleaned);
  if (!Array.isArray(parsed)) throw new Error("Claude did not return an array");

  return parsed.map((item: Record<string, unknown>) => ({
    category: String(item.category ?? "general"),
    title: String(item.title ?? "Insight"),
    body: String(item.body ?? ""),
    priority: Math.min(5, Math.max(1, Number(item.priority ?? 3))),
  })) as RawInsight[];
}
