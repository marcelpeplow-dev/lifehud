import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

const Schema = z.object({
  display_name: z.string().min(1).max(80),
  date_of_birth: z.string().nullable().optional(),
  height_cm: z.number().positive().nullable().optional(),
  weight_kg: z.number().positive().nullable().optional(),
  timezone: z.string().min(1).max(60),
  sleep_target_minutes: z.number().int().min(180).max(720).optional(),
  weekly_workouts_target: z.number().int().min(1).max(14).optional(),
});

export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const body = await request.json();
    const parsed = Schema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    }

    const { sleep_target_minutes, weekly_workouts_target, ...profileFields } = parsed.data;

    // Update profile + mark onboarding complete
    const { error: profileError } = await supabase
      .from("profiles")
      .update({ ...profileFields, onboarding_completed: true })
      .eq("id", user.id);

    if (profileError) return NextResponse.json({ error: profileError.message }, { status: 500 });

    // Insert initial goals
    const today = new Date().toISOString().slice(0, 10);
    const goals = [];

    if (sleep_target_minutes) {
      goals.push({
        user_id: user.id,
        title: `Sleep ${Math.round(sleep_target_minutes / 60 * 10) / 10} hours per night`,
        category: "sleep",
        metric_name: "sleep_duration",
        target_value: sleep_target_minutes,
        target_unit: "min",
        target_frequency: "daily",
        current_value: 0,
        start_date: today,
        is_active: true,
      });
    }

    if (weekly_workouts_target) {
      goals.push({
        user_id: user.id,
        title: `Work out ${weekly_workouts_target}× per week`,
        category: "fitness",
        metric_name: "weekly_workouts",
        target_value: weekly_workouts_target,
        target_unit: "workouts",
        target_frequency: "weekly",
        current_value: 0,
        start_date: today,
        is_active: true,
      });
    }

    if (goals.length) await supabase.from("goals").insert(goals);

    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
