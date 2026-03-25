import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

const ConfigSchema = z.object({
  configs: z.array(
    z.object({
      domain: z.string(),
      metric_id: z.string(),
      enabled: z.boolean(),
      display_order: z.number().int(),
    }),
  ),
});

export async function GET() {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { data, error } = await supabase
      .from("user_manual_config")
      .select("*")
      .eq("user_id", user.id)
      .order("display_order");

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ configs: data ?? [] });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const body = await request.json();
    const { configs } = ConfigSchema.parse(body);

    const rows = configs.map((c) => ({
      user_id: user.id,
      domain: c.domain,
      metric_id: c.metric_id,
      enabled: c.enabled,
      display_order: c.display_order,
    }));

    const { data, error } = await supabase
      .from("user_manual_config")
      .upsert(rows, { onConflict: "user_id,metric_id" })
      .select();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ configs: data ?? [] });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: err.issues[0].message }, { status: 400 });
    }
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
