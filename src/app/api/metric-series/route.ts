import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { fetchMetricSeries } from "@/lib/metrics/fetch-series";
import { getMetricById } from "@/lib/metrics/registry";

export async function GET(req: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const metricId = req.nextUrl.searchParams.get("metricId");
    const daysParam = req.nextUrl.searchParams.get("days") ?? "30";
    const days = (["7", "30", "90"].includes(daysParam) ? parseInt(daysParam) : 30) as 7 | 30 | 90;

    if (!metricId) return NextResponse.json({ error: "metricId required" }, { status: 400 });

    const metric = getMetricById(metricId);
    if (!metric) return NextResponse.json({ error: "Unknown metric" }, { status: 404 });

    const series = await fetchMetricSeries(metricId, user.id, supabase, days);
    return NextResponse.json({ series, unit: metric.unitLabel, metricName: metric.shortName });
  } catch (err) {
    console.error("GET /api/metric-series:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
