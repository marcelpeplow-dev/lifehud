import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { getMetricById } from "@/lib/metrics/registry";

const Schema = z.object({
  title: z.string().min(1).max(100),
  domain: z.string().min(1).max(50),
  metric_id: z.string().min(1).max(80),
  target_value: z.number().positive(),
  target_date: z.string().nullable().optional(),
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

    const { domain, metric_id, target_value, title, target_date } = parsed.data;

    // Auto-resolve unit from registry
    const metric = getMetricById(metric_id);
    const unit = metric?.unitLabel ?? metric?.unit ?? "";

    const today = new Date().toISOString().slice(0, 10);
    const { data, error } = await supabase
      .from("goals")
      .insert({
        user_id: user.id,
        title,
        domain,
        metric_id,
        unit,
        status: "active",
        starred: false,
        // Legacy compat fields
        category: (["sleep", "fitness", "recovery", "general"].includes(domain)
          ? domain
          : "general") as "sleep" | "fitness" | "recovery" | "general",
        metric_name: metric_id,
        target_unit: unit,
        target_frequency: "daily",
        target_value,
        current_value: 0,
        start_date: today,
        is_active: true,
        target_date: target_date ?? null,
      })
      .select()
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json(data, { status: 201 });
  } catch {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
