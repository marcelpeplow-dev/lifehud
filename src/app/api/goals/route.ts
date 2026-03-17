import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

const CreateGoalSchema = z.object({
  title: z.string().min(1).max(100),
  category: z.enum(["sleep", "fitness", "recovery", "general"]),
  metric_name: z.string().min(1).max(50),
  target_value: z.number().positive(),
  target_unit: z.string().min(1).max(30),
  target_frequency: z.enum(["daily", "weekly", "monthly"]),
  target_date: z.string().nullable().optional(),
});

export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const body = await request.json();
    const parsed = CreateGoalSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    }

    const { data, error } = await supabase.from("goals").insert({
      user_id: user.id,
      ...parsed.data,
      target_date: parsed.data.target_date ?? null,
      current_value: 0,
      start_date: new Date().toISOString().slice(0, 10),
      is_active: true,
    }).select().single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json(data, { status: 201 });
  } catch {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
