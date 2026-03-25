import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { z } from "zod";

const UpsertSchema = z.object({
  config_type: z.string(),
  position: z.number().int().min(0).max(10),
  domain: z.string().nullable().optional(),
  config: z.record(z.string(), z.unknown()),
});

const DeleteSchema = z.object({
  config_type: z.string(),
  position: z.number().int().min(0).max(10),
  domain: z.string().nullable().optional(),
});

export async function GET(req: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const domain = req.nextUrl.searchParams.get("domain");
    const config_type = req.nextUrl.searchParams.get("config_type");

    let query = supabase
      .from("user_dashboard_config")
      .select("*")
      .eq("user_id", user.id);

    if (domain !== null) {
      query = domain === "null"
        ? query.is("domain", null)
        : query.eq("domain", domain);
    }
    if (config_type) query = query.eq("config_type", config_type);

    const { data, error } = await query.order("position");
    if (error) throw error;

    return NextResponse.json({ configs: data ?? [] });
  } catch (err) {
    console.error("GET /api/dashboard-config:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const body = await req.json();
    const parsed = UpsertSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    }

    const { config_type, position, domain, config } = parsed.data;

    const { data, error } = await supabase
      .from("user_dashboard_config")
      .upsert(
        {
          user_id: user.id,
          config_type,
          position,
          domain: domain ?? null,
          config,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "user_id,config_type,position,domain" }
      )
      .select()
      .single();

    if (error) throw error;
    return NextResponse.json({ config: data });
  } catch (err) {
    console.error("PUT /api/dashboard-config:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const body = await req.json();
    const parsed = DeleteSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    }

    const { config_type, position, domain } = parsed.data;

    let query = supabase
      .from("user_dashboard_config")
      .delete()
      .eq("user_id", user.id)
      .eq("config_type", config_type)
      .eq("position", position);

    if (domain != null) query = query.eq("domain", domain);
    else query = query.is("domain", null);

    const { error } = await query;
    if (error) throw error;

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("DELETE /api/dashboard-config:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
