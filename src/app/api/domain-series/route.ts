import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { fetchMetricSeries } from "@/lib/metrics/fetch-series";
import { getMetricsByDomain } from "@/lib/metrics/registry";
import type { Domain } from "@/lib/analysis/domains";
import { ALL_DOMAINS } from "@/lib/analysis/domains";
import type { SeriesPoint } from "@/lib/metrics/fetch-series";

// GET /api/domain-series?domain=sleep&days=7
// Returns: { series: Record<metricId, SeriesPoint[]> }
export async function GET(req: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const domain = req.nextUrl.searchParams.get("domain") as Domain | null;
    if (!domain || !ALL_DOMAINS.includes(domain)) {
      return NextResponse.json({ error: "Invalid domain" }, { status: 400 });
    }

    const daysParam = req.nextUrl.searchParams.get("days") ?? "7";
    const days = (["7", "30", "90"].includes(daysParam) ? parseInt(daysParam) : 7) as 7 | 30 | 90;

    const metrics = getMetricsByDomain(domain).filter(
      (m) => m.unit !== "text" && m.unit !== "category" && m.unit !== "name"
    );

    const results = await Promise.all(
      metrics.map(async (m) => {
        const series = await fetchMetricSeries(m.id, user.id, supabase, days);
        return { metricId: m.id, series };
      })
    );

    const series: Record<string, SeriesPoint[]> = {};
    for (const r of results) series[r.metricId] = r.series;

    return NextResponse.json({ series });
  } catch (err) {
    console.error("GET /api/domain-series:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
