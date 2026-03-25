"use client";

import { useState, useEffect, useCallback } from "react";
import { Plus, TrendingUp, TrendingDown, Minus, X } from "lucide-react";
import {
  Moon, Dumbbell, Crown, Heart, Activity,
  Coffee, Droplets, Pill, Monitor, Wine,
} from "lucide-react";
import { MetricPickerModal } from "./MetricPickerModal";
import { getMetricById } from "@/lib/metrics/registry";
import { getDomainById } from "@/lib/metrics/domains";

const DOMAIN_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  moon: Moon, dumbbell: Dumbbell, crown: Crown, heart: Heart,
  activity: Activity, coffee: Coffee, droplets: Droplets,
  pill: Pill, monitor: Monitor, wine: Wine,
};

const DOMAIN_TEXT_COLORS: Record<string, string> = {
  "blue-400": "text-blue-400", "green-400": "text-green-400",
  "amber-400": "text-amber-400", "rose-400": "text-rose-400",
  "emerald-400": "text-emerald-400", "orange-400": "text-orange-400",
  "cyan-400": "text-cyan-400", "purple-400": "text-purple-400",
  "indigo-400": "text-indigo-400", "red-400": "text-red-400",
};

interface StatCardConfig {
  metricId: string;
  domain: string;
}

interface ConfigurableStatCardProps {
  position: number;
  domain?: string | null;
  initialConfig?: StatCardConfig | null;
}

export function ConfigurableStatCard({ position, domain = null, initialConfig = null }: ConfigurableStatCardProps) {
  const [config, setConfig] = useState<StatCardConfig | null>(initialConfig);
  const [value, setValue] = useState<string | null>(null);
  const [trend, setTrend] = useState<"up" | "down" | "flat" | null>(null);
  const [loading, setLoading] = useState(false);
  const [showPicker, setShowPicker] = useState(false);
  const [showActions, setShowActions] = useState(false);

  const fetchValue = useCallback(async (metricId: string) => {
    setLoading(true);
    try {
      const res = await fetch(`/api/metric-value?metricId=${metricId}&period=7d`);
      if (!res.ok) return;
      const data = await res.json() as { formatted: string | null; trend: "up" | "down" | "flat" | null };
      setValue(data.formatted);
      setTrend(data.trend);
    } catch { /* silent */ } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (config) {
      fetchValue(config.metricId);
    }
  }, [config, fetchValue]);

  async function handleSelect(metricId: string, domainId: string) {
    const newConfig: StatCardConfig = { metricId, domain: domainId };
    setShowPicker(false);
    setConfig(newConfig);

    await fetch("/api/dashboard-config", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        config_type: "stat_card",
        position,
        domain: domain ?? null,
        config: newConfig,
      }),
    });
  }

  async function handleRemove() {
    setShowActions(false);
    setConfig(null);
    setValue(null);
    setTrend(null);

    await fetch("/api/dashboard-config", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ config_type: "stat_card", position, domain: domain ?? null }),
    });
  }

  if (!config) {
    return (
      <>
        <button
          onClick={() => setShowPicker(true)}
          className="bg-zinc-900 border border-dashed border-zinc-700 rounded-xl p-5 flex flex-col items-center justify-center gap-2 min-h-[110px] hover:border-zinc-500 hover:bg-zinc-800/50 transition-all group"
        >
          <Plus className="w-5 h-5 text-zinc-600 group-hover:text-zinc-400 transition-colors" />
          <span className="text-xs text-zinc-600 group-hover:text-zinc-400 transition-colors">Add metric</span>
        </button>
        {showPicker && <MetricPickerModal onSelect={handleSelect} onClose={() => setShowPicker(false)} />}
      </>
    );
  }

  const metric = getMetricById(config.metricId);
  const domainDef = getDomainById(config.domain as Parameters<typeof getDomainById>[0]);
  const Icon = domainDef ? (DOMAIN_ICONS[domainDef.icon] ?? Activity) : null;
  const iconColor = domainDef ? (DOMAIN_TEXT_COLORS[domainDef.color] ?? "text-zinc-400") : "text-zinc-400";

  const TrendIcon = trend === "up" ? TrendingUp : trend === "down" ? TrendingDown : Minus;
  const trendColor = trend === null ? "text-zinc-600"
    : trend === "flat" ? "text-zinc-500"
    : trend === "up" ? "text-emerald-400" : "text-red-400";

  return (
    <>
      <div
        className="bg-zinc-900 border border-zinc-800 rounded-xl p-5 min-h-[110px] cursor-pointer hover:border-zinc-700 transition-colors relative group"
        onClick={() => setShowActions((s) => !s)}
      >
        {/* Domain icon + metric name */}
        <div className="flex items-start justify-between mb-3">
          <span className="text-xs font-medium text-zinc-400 leading-tight pr-2">
            {metric?.shortName ?? config.metricId}
          </span>
          {Icon && <Icon className={`w-4 h-4 shrink-0 ${iconColor}`} />}
        </div>

        {/* Value */}
        <div className="text-2xl font-semibold text-zinc-50 tabular-nums mb-1">
          {loading ? <span className="text-zinc-600 text-lg">—</span> : (value ?? "—")}
        </div>

        {/* Trend */}
        {trend !== null && (
          <span className={`inline-flex items-center gap-1 text-xs font-medium ${trendColor}`}>
            <TrendIcon className="w-3 h-3 shrink-0" />
            vs prior week
          </span>
        )}

        {/* Unit label */}
        {!trend && metric && (
          <span className="text-xs text-zinc-600">{metric.unitLabel}</span>
        )}

        {/* Actions overlay */}
        {showActions && (
          <div
            className="absolute inset-0 bg-zinc-900/95 rounded-xl flex items-center justify-center gap-3"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              onClick={() => { setShowActions(false); setShowPicker(true); }}
              className="text-xs px-3 py-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-300 transition-colors"
            >
              Change
            </button>
            <button
              onClick={handleRemove}
              className="text-xs px-3 py-1.5 rounded-lg bg-zinc-800 hover:bg-red-900/50 text-red-400 transition-colors flex items-center gap-1"
            >
              <X className="w-3 h-3" /> Remove
            </button>
          </div>
        )}
      </div>

      {showPicker && <MetricPickerModal onSelect={handleSelect} onClose={() => setShowPicker(false)} />}
    </>
  );
}
