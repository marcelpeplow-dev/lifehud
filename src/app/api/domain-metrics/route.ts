import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { fetchDomainMetricsBatch } from "@/lib/metrics/fetch-domain-batch";
import { getMetricById, getMetricsByDomain } from "@/lib/metrics/registry";
import type { Domain } from "@/lib/analysis/domains";
import { ALL_DOMAINS } from "@/lib/analysis/domains";

export async function GET(req: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const domain = req.nextUrl.searchParams.get("domain") as Domain | null;
    if (!domain || !ALL_DOMAINS.includes(domain)) {
      return NextResponse.json({ error: "Invalid domain" }, { status: 400 });
    }

    const batchResults = await fetchDomainMetricsBatch(domain, user.id, supabase);

    // Enrich with metric metadata
    const metrics = batchResults.map((r) => {
      const def = getMetricById(r.metricId);
      return {
        ...r,
        name: def?.name ?? r.metricId,
        shortName: def?.shortName ?? r.metricId,
        description: def?.description ?? "",
        unit: def?.unit ?? "",
        unitLabel: def?.unitLabel ?? "",
        healthyRange: def?.healthyRange ?? null,
        format: undefined, // Can't serialize functions
        formatted: {
          today: r.today != null && def ? def.format(r.today) : null,
          avg7d: r.avg7d != null && def ? def.format(r.avg7d) : null,
          avg30d: r.avg30d != null && def ? def.format(r.avg30d) : null,
          avg90d: r.avg90d != null && def ? def.format(r.avg90d) : null,
        },
      };
    });

    return NextResponse.json({ metrics });
  } catch (err) {
    console.error("GET /api/domain-metrics:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
