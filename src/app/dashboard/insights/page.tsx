import { Suspense } from "react";
import { Sparkles } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { InsightCard } from "@/components/dashboard/InsightCard";
import { DomainFilter, StatusFilter } from "@/components/insights/InsightFilters";
import { GenerateButton } from "@/components/insights/GenerateButton";
import { RevealSection } from "@/components/insights/RevealSection";
import { detectDomains, type Domain, ALL_DOMAINS } from "@/lib/insights/domains";
import type { Insight, InsightCategory, InsightRarity } from "@/types/index";
import { redirect } from "next/navigation";

const RARITY_RANK: Record<InsightRarity, number> = {
  legendary: 0, epic: 1, rare: 2, uncommon: 3, common: 4,
};

const VALID_STATUSES = new Set(["active", "unread", "dismissed"]);

/** Parse and validate the comma-separated domains param. */
function parseDomains(raw: string | undefined): Domain[] {
  if (!raw) return [];
  return raw.split(",").filter((d) => ALL_DOMAINS.includes(d as Domain)) as Domain[];
}

export default async function InsightsPage({
  searchParams,
}: {
  searchParams: Promise<{ domains?: string; status?: string; category?: string }>;
}) {
  const { domains: rawDomains, status: rawStatus = "active", category: legacyCat } = await searchParams;
  const status = VALID_STATUSES.has(rawStatus) ? rawStatus : "active";
  const selectedDomains = parseDomains(rawDomains ?? (legacyCat && legacyCat !== "all" ? legacyCat : undefined));

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  // Fetch all insights for this status — domain filtering happens client-side
  // because it requires text scanning
  let query = supabase
    .from("insights")
    .select("*")
    .eq("user_id", user.id)
    .order("date", { ascending: false })
    .order("priority", { ascending: false })
    .limit(100);

  // Status filter
  if (status === "active") query = query.eq("is_dismissed", false);
  else if (status === "unread") query = query.eq("is_dismissed", false).eq("is_read", false);
  else if (status === "dismissed") query = query.eq("is_dismissed", true);

  const { data } = await query;
  let insights = ((data ?? []) as Insight[]);

  // Domain filtering: if specific domains selected, only keep insights
  // that touch ALL of the selected domains
  if (selectedDomains.length > 0) {
    insights = insights.filter((ins) => {
      const detected = detectDomains(
        ins.category as InsightCategory,
        ins.title,
        ins.body,
      );
      return selectedDomains.every((d) => detected.includes(d));
    });
  }

  // Sort: rarity first (legendary → common), then newest first
  insights.sort((a, b) => {
    const ra = RARITY_RANK[a.rarity ?? "common"];
    const rb = RARITY_RANK[b.rarity ?? "common"];
    if (ra !== rb) return ra - rb;
    return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
  });

  // Unread insights (for pack reveal prompt)
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

  const domainsParam = selectedDomains.join(",");

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-2xl font-semibold text-zinc-50 tracking-tight">Insights</h1>
            {(unreadCount ?? 0) > 0 && (
              <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-emerald-500 text-zinc-950 text-xs font-bold">
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

      {/* Filters */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-3">
        <Suspense>
          <DomainFilter active={domainsParam} />
        </Suspense>
        <div className="sm:ml-auto">
          <Suspense>
            <StatusFilter active={status} />
          </Suspense>
        </div>
      </div>

      {/* Insights grid */}
      {insights.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {insights.map((insight) => (
            <InsightCard key={insight.id} insight={insight} />
          ))}
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <div className="w-12 h-12 rounded-full bg-zinc-800 flex items-center justify-center mb-4">
            <Sparkles className="w-6 h-6 text-zinc-600" />
          </div>
          <p className="text-sm font-medium text-zinc-300 mb-1">
            {status === "dismissed" ? "No dismissed insights" : selectedDomains.length > 0 ? "No matching insights" : "No insights yet"}
          </p>
          <p className="text-xs text-zinc-500 mb-5">
            {status === "dismissed"
              ? "Dismissed insights will appear here"
              : selectedDomains.length > 0
                ? "Try selecting different domains or generate new insights"
                : "Generate your first AI coaching insight based on your data"}
          </p>
          {status !== "dismissed" && <GenerateButton />}
        </div>
      )}
    </div>
  );
}
