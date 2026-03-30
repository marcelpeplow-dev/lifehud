"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Star, Archive, Moon, Dumbbell, Crown, Heart, Activity, Coffee, Droplets, Pill, Monitor, Wine } from "lucide-react";
import { getMetricById } from "@/lib/metrics/registry";
import { DOMAIN_REGISTRY } from "@/lib/metrics/domains";
import { calcProgress, formatDuration } from "@/lib/utils/metrics";
import { formatRelativeDate } from "@/lib/utils/dates";
import type { Goal } from "@/types/index";
import type { Domain } from "@/lib/analysis/domains";

const DOMAIN_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  moon: Moon, dumbbell: Dumbbell, crown: Crown, heart: Heart,
  activity: Activity, coffee: Coffee, droplets: Droplets,
  pill: Pill, monitor: Monitor, wine: Wine,
};
const DOMAIN_TEXT: Record<string, string> = {
  "blue-400": "text-blue-400", "green-400": "text-green-400", "amber-400": "text-amber-400",
  "rose-400": "text-rose-400", "emerald-400": "text-emerald-400", "orange-400": "text-orange-400",
  "cyan-400": "text-cyan-400", "purple-400": "text-purple-400", "indigo-400": "text-indigo-400",
  "red-400": "text-red-400",
};
const DOMAIN_BG: Record<string, string> = {
  "blue-400": "bg-blue-500/10", "green-400": "bg-green-500/10", "amber-400": "bg-amber-500/10",
  "rose-400": "bg-rose-500/10", "emerald-400": "bg-emerald-500/10", "orange-400": "bg-orange-500/10",
  "cyan-400": "bg-cyan-500/10", "purple-400": "bg-purple-500/10", "indigo-400": "bg-indigo-500/10",
  "red-400": "bg-red-500/10",
};

// Fallback formatter for old-style goals that predate the registry
function legacyFormat(goal: Goal, value: number): string {
  switch (goal.metric_name) {
    case "sleep_duration": return `${formatDuration(value)} / ${formatDuration(goal.target_value)}`;
    case "weekly_workouts": return `${value} / ${goal.target_value} workouts`;
    case "steps": return `${value.toLocaleString()} / ${goal.target_value.toLocaleString()} steps`;
    default: return `${value} / ${goal.target_value} ${goal.target_unit}`;
  }
}

interface Props {
  goal: Goal;
  currentValue: number;
}

export function GoalCard({ goal, currentValue }: Props) {
  const router = useRouter();
  const [starred, setStarred] = useState(goal.starred ?? false);
  const [archiving, setArchiving] = useState(false);

  const metric = goal.metric_id ? getMetricById(goal.metric_id) : null;
  const domainId = (goal.domain ?? goal.category) as Domain;
  const domainDef = DOMAIN_REGISTRY.find((d) => d.id === domainId);
  const DomainIcon = DOMAIN_ICONS[domainDef?.icon ?? "activity"] ?? Activity;
  const iconColor = DOMAIN_TEXT[domainDef?.color ?? ""] ?? "text-zinc-400";
  const iconBg = DOMAIN_BG[domainDef?.color ?? ""] ?? "bg-zinc-700";

  const pct = calcProgress(currentValue, goal.target_value);
  const progressColor =
    pct >= 100 ? "bg-emerald-500" :
    pct >= 67  ? "bg-blue-500" :
    pct >= 34  ? "bg-amber-500" :
                 "bg-red-500";

  const currentFormatted = metric
    ? `${metric.format(currentValue)} / ${metric.format(goal.target_value)}`
    : legacyFormat(goal, currentValue);

  async function toggleStar() {
    const next = !starred;
    setStarred(next);
    await fetch(`/api/goals/${goal.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ starred: next }),
    });
  }

  async function archive() {
    if (!confirm("Archive this goal?")) return;
    setArchiving(true);
    await fetch(`/api/goals/${goal.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ is_active: false, status: "archived" }),
    });
    router.refresh();
    setArchiving(false);
  }

  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5">
      {/* Header */}
      <div className="flex items-start justify-between gap-3 mb-4">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${iconBg}`}>
            <DomainIcon className={`w-4 h-4 ${iconColor}`} />
          </div>
          <div className="min-w-0">
            <p className="text-xs text-zinc-500">{domainDef?.name ?? goal.category}</p>
            <h3 className="text-sm font-medium text-zinc-50 leading-tight truncate">{goal.title}</h3>
          </div>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          <button
            onClick={toggleStar}
            className={`p-1.5 rounded-md transition-colors ${starred ? "text-amber-400 hover:text-amber-300" : "text-zinc-600 hover:text-zinc-400 hover:bg-zinc-800"}`}
            title={starred ? "Unpin from dashboard" : "Pin to dashboard"}
          >
            <Star className={`w-4 h-4 ${starred ? "fill-amber-400" : ""}`} />
          </button>
          <button
            onClick={archive}
            disabled={archiving}
            className="p-1.5 rounded-md text-zinc-600 hover:text-zinc-400 hover:bg-zinc-800 transition-colors disabled:opacity-40"
            title="Archive goal"
          >
            <Archive className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Progress */}
      <div className="mb-3">
        <div className="flex items-center justify-between mb-1.5">
          <span className="text-xs text-zinc-400">{currentFormatted}</span>
          <span className={`text-xs font-semibold tabular-nums ${pct >= 100 ? "text-emerald-400" : pct >= 67 ? "text-blue-400" : pct >= 34 ? "text-amber-400" : "text-red-400"}`}>
            {pct}%
          </span>
        </div>
        <div className="h-2 bg-zinc-800 rounded-full overflow-hidden">
          <div className={`h-full ${progressColor} rounded-full transition-all`} style={{ width: `${Math.min(pct, 100)}%` }} />
        </div>
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between">
        <span className="text-xs text-zinc-500">{metric?.unitLabel ?? goal.target_unit}</span>
        {goal.target_date && (
          <span className="text-xs text-zinc-500">Due {formatRelativeDate(goal.target_date)}</span>
        )}
      </div>
    </div>
  );
}
