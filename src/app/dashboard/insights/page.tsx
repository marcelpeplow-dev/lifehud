import { createClient } from "@/lib/supabase/server";
import { Sparkles } from "lucide-react";
import { GenerateButton } from "@/components/insights/GenerateButton";
import { RevealSection } from "@/components/insights/RevealSection";
import { InsightList } from "@/components/insights/InsightList";
import type { Insight } from "@/types/index";
import { redirect } from "next/navigation";

const VALID_STATUSES = new Set(["active", "unread", "dismissed"]);

export default async function InsightsPage({
  searchParams,
}: {
  searchParams: Promise<{ domains?: string; status?: string; category?: string }>;
}) {
  const { domains: rawDomains, status: rawStatus = "active", category: legacyCat } = await searchParams;
  const status = VALID_STATUSES.has(rawStatus) ? rawStatus : "active";
  // Pass initial domains to client component for hydration; filtering is done client-side
  const initialDomains = rawDomains ?? (legacyCat && legacyCat !== "all" ? legacyCat : "");

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  // Fetch all insights for this status — domain filtering happens instantly client-side
  let query = supabase
    .from("insights")
    .select("*")
    .eq("user_id", user.id)
    .order("date", { ascending: false })
    .order("priority", { ascending: false })
    .limit(100);

  if (status === "active") query = query.eq("is_dismissed", false);
  else if (status === "unread") query = query.eq("is_dismissed", false).eq("is_read", false);
  else if (status === "dismissed") query = query.eq("is_dismissed", true);

  const { data } = await query;
  const insights = (data ?? []) as Insight[];

  // Unread pack reveal prompt
  const { data: unreadData, count: unreadCount } = await supabase
    .from("insights")
    .select("*", { count: "exact" })
    .eq("user_id", user.id)
    .eq("is_dismissed", false)
    .eq("is_read", false)
    .order("date", { ascending: false })
    .order("priority", { ascending: false })
    .limit(12);
  const unreadInsights = (unreadData ?? []) as Insight[];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-2xl font-semibold text-zinc-50 tracking-tight">Insights</h1>
            {(unreadCount ?? 0) > 0 && (
              <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-blue-500 text-zinc-950 text-xs font-bold">
                {unreadCount}
              </span>
            )}
          </div>
          <p className="text-sm text-zinc-400 mt-0.5">AI-generated coaching based on your data</p>
        </div>
        <GenerateButton />
      </div>

      {/* Unread pack reveal prompt */}
      {unreadInsights.length > 0 && (
        <RevealSection insights={unreadInsights} />
      )}

      {/* Insight list with client-side domain filter (instant) + URL-based status filter */}
      <InsightList insights={insights} status={status} initialDomains={initialDomains} />
    </div>
  );
}
