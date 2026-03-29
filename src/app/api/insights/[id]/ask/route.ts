import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import Anthropic from "@anthropic-ai/sdk";

const MODEL = "claude-sonnet-4-6";

const QUESTION_PROMPTS: Record<string, string> = {
  trend:
    "The user wants to know how this pattern has been changing over time. Based on the insight data, describe the trend briefly — is it improving, worsening, or stable? Be specific with numbers if available. 2-3 sentences max.",
  action:
    "The user wants a specific, actionable recommendation based on this insight. Give ONE concrete thing they can do today or this week. Be direct, like a coach. 2-3 sentences max.",
  connections:
    "The user wants to know what other health domains this insight connects to. Explain what related metrics or behaviors are affected. 2-3 sentences max.",
};

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const body = await req.json();
  const type = body.type as string;

  if (!type || !QUESTION_PROMPTS[type]) {
    return NextResponse.json({ error: "Invalid question type" }, { status: 400 });
  }

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data: insight } = await supabase
    .from("insights")
    .select("*")
    .eq("id", id)
    .eq("user_id", user.id)
    .single();

  if (!insight) {
    return NextResponse.json({ error: "Insight not found" }, { status: 404 });
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: "AI not configured" }, { status: 500 });
  }

  const client = new Anthropic({ apiKey });

  const message = await client.messages.create({
    model: MODEL,
    max_tokens: 300,
    system: "You are a personal health coach. Respond in second person (you/your). Use full words, not abbreviations. No em dashes. Be concise and direct. If the insight does not contain enough real data to give a meaningful answer, respond with only the word: INSUFFICIENT_DATA",
    messages: [
      {
        role: "user",
        content: `Insight title: ${insight.title}\nInsight body: ${insight.body}\nCategory: ${insight.category}\n\n${QUESTION_PROMPTS[type]}`,
      },
    ],
  });

  const response = message.content.find((b) => b.type === "text")?.text?.trim() ?? "";

  return NextResponse.json({ response });
}
