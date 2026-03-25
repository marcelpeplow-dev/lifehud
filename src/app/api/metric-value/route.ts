import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { fetchMetricValue } from "@/lib/metrics/fetch";
import { getMetricById } from "@/lib/metrics/registry";

export async function GET(req: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const metricId = req.nextUrl.searchParams.get("metricId");
    const period = (req.nextUrl.searchParams.get("period") ?? "7d") as "today" | "7d" | "30d" | "90d";

    if (!metricId) {
      return NextResponse.json({ error: "metricId is required" }, { status: 400 });
    }

    const metric = getMetricById(metricId);
    if (!metric) {
      return NextResponse.json({ error: "Unknown metric" }, { status: 404 });
    }

    const result = await fetchMetricValue(metricId, user.id, supabase, period);
    const formatted = result.value != null ? metric.format(result.value) : null;

    return NextResponse.json({ ...result, formatted });
  } catch (err) {
    console.error("GET /api/metric-value:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
