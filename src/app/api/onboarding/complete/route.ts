import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { DOMAIN_REGISTRY } from "@/lib/metrics/domains";

const Schema = z.object({
  display_name: z.string().min(1).max(80),
  date_of_birth: z.string().nullable().optional(),
  height_cm: z.number().positive().nullable().optional(),
  weight_kg: z.number().positive().nullable().optional(),
  timezone: z.string().min(1).max(60),
  selected_domains: z.array(z.string()).optional(),
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

    const { selected_domains, ...profileFields } = parsed.data;

    // Update profile + mark onboarding complete
    const { error: profileError } = await supabase
      .from("profiles")
      .update({ ...profileFields, onboarding_completed: true })
      .eq("id", user.id);

    if (profileError) return NextResponse.json({ error: profileError.message }, { status: 500 });

    // Enable default metrics for selected manual domains
    if (selected_domains && selected_domains.length > 0) {
      const manualConfigs: {
        user_id: string;
        domain: string;
        metric_id: string;
        enabled: boolean;
        display_order: number;
      }[] = [];

      for (const domainId of selected_domains) {
        const domain = DOMAIN_REGISTRY.find((d) => d.id === domainId);
        if (!domain || domain.source !== "manual" || domain.defaultMetrics.length === 0) continue;
        domain.defaultMetrics.forEach((metricId, idx) => {
          manualConfigs.push({
            user_id: user.id,
            domain: domainId,
            metric_id: metricId,
            enabled: true,
            display_order: idx,
          });
        });
      }

      if (manualConfigs.length > 0) {
        await supabase
          .from("user_manual_config")
          .upsert(manualConfigs, { onConflict: "user_id,metric_id" });
      }
    }

    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
