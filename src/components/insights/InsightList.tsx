"use client";

import { useState, useMemo, memo } from "react";
import { Sparkles } from "lucide-react";
import { InsightCard } from "@/components/dashboard/InsightCard";
import { DomainIcon } from "@/components/ui/Badge";
import { StatusFilter } from "@/components/insights/InsightFilters";
import { GenerateButton } from "@/components/insights/GenerateButton";
import { detectDomains } from "@/lib/insights/domains";
import type { Insight, InsightCategory, InsightRarity } from "@/types/index";
import type { Domain } from "@/lib/insights/domains";

const MemoInsightCard = memo(InsightCard);

const RARITY_RANK: Record<InsightRarity, number> = {
  legendary: 0, epic: 1, rare: 2, uncommon: 3, common: 4,
};

const FILTER_DOMAINS: { label: string; value: Domain; category: InsightCategory }[] = [
  { label: "Sleep",     value: "sleep",     category: "sleep" },
  { label: "Fitness",   value: "fitness",   category: "fitness" },
  { label: "Chess",     value: "chess",     category: "chess" },
  { label: "Wellbeing", value: "wellbeing", category: "wellbeing" },
  { label: "Recovery",  value: "recovery",  category: "recovery" },
];

interface InsightListProps {
  insights: Insight[];
  status: string;
  initialDomains: string;
}

export function InsightList({ insights, status, initialDomains }: InsightListProps) {
  const [activeDomains, setActiveDomains] = useState<Set<Domain>>(
    () => new Set((initialDomains ? initialDomains.split(",").filter(Boolean) : []) as Domain[])
  );

  const filtered = useMemo(() => {
    let result = insights;
    if (activeDomains.size > 0) {
      result = result.filter((ins) => {
        const detected = detectDomains(ins.category as InsightCategory, ins.title, ins.body);
        return Array.from(activeDomains).every((d) => detected.includes(d));
      });
    }
    return [...result].sort((a, b) => {
      const ra = RARITY_RANK[a.rarity ?? "common"] ?? 4;
      const rb = RARITY_RANK[b.rarity ?? "common"] ?? 4;
      if (ra !== rb) return ra - rb;
      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
    });
  }, [insights, activeDomains]);

  function toggle(domain: Domain) {
    setActiveDomains((prev) => {
      const next = new Set(prev);
      if (next.has(domain)) next.delete(domain);
      else next.add(domain);
      return next;
    });
  }

  const isAll = activeDomains.size === 0;

  return (
    <div className="space-y-6">
      {/* Filter row */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-3">
        <div className="flex gap-1.5 flex-wrap">
          <button
            onClick={() => setActiveDomains(new Set())}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
              isAll ? "bg-zinc-700 text-zinc-50" : "text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800"
            }`}
          >
            All
          </button>
          {FILTER_DOMAINS.map((d) => {
            const selected = activeDomains.has(d.value);
            return (
              <button
                key={d.value}
                onClick={() => toggle(d.value)}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                  selected ? "bg-zinc-700 text-zinc-50" : "text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800"
                }`}
              >
                <DomainIcon category={d.category} className={selected ? "" : "opacity-80"} size={12} active={selected} />
                {d.label}
              </button>
            );
          })}
        </div>
        <div className="sm:ml-auto">
          <StatusFilter active={status} />
        </div>
      </div>

      {/* Grid */}
      {filtered.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filtered.map((insight) => (
            <MemoInsightCard key={insight.id} insight={insight} />
          ))}
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <div className="w-12 h-12 rounded-full bg-zinc-800 flex items-center justify-center mb-4">
            <Sparkles className="w-6 h-6 text-zinc-600" />
          </div>
          <p className="text-sm font-medium text-zinc-300 mb-1">
            {status === "dismissed"
              ? "No dismissed insights"
              : activeDomains.size > 0
              ? "No matching insights"
              : "No insights yet"}
          </p>
          <p className="text-xs text-zinc-500 mb-5">
            {status === "dismissed"
              ? "Dismissed insights will appear here"
              : activeDomains.size > 0
              ? "Try selecting different domains or generate new insights"
              : "Generate your first AI coaching insight based on your data"}
          </p>
          {status !== "dismissed" && <GenerateButton />}
        </div>
      )}
    </div>
  );
}
