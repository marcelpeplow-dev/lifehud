"use client";

import { useDomainMetrics } from "@/hooks/useDomainMetrics";
import { TrendingUp, TrendingDown, Minus } from "lucide-react";
import type { Domain } from "@/lib/analysis/domains";

interface HealthDotProps {
  value: number | null;
  healthyRange: { min: number; max: number } | null;
}

function HealthDot({ value, healthyRange }: HealthDotProps) {
  if (value == null || !healthyRange) return <span className="w-1.5 h-1.5" />;
  const { min, max } = healthyRange;
  const tolerance = (max - min) * 0.2;
  if (value >= min && value <= max) return <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 inline-block shrink-0" title="In healthy range" />;
  if (value >= min - tolerance && value <= max + tolerance) return <span className="w-1.5 h-1.5 rounded-full bg-amber-400 inline-block shrink-0" title="Close to healthy range" />;
  return <span className="w-1.5 h-1.5 rounded-full bg-red-400 inline-block shrink-0" title="Outside healthy range" />;
}

interface MetricTableProps {
  domain: Domain;
}

export function MetricTable({ domain }: MetricTableProps) {
  const { metrics, loading, error } = useDomainMetrics(domain);

  if (loading) {
    return (
      <div className="bg-zinc-900 border border-zinc-800 rounded-xl">
        {[...Array(6)].map((_, i) => (
          <div key={i} className={`flex items-center justify-between px-5 py-3 ${i % 2 === 0 ? "bg-zinc-900" : "bg-zinc-950/40"} ${i > 0 ? "border-t border-zinc-800/50" : ""}`}>
            <div className="h-4 w-32 bg-zinc-800 rounded animate-pulse" />
            <div className="h-4 w-48 bg-zinc-800 rounded animate-pulse" />
          </div>
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5">
        <p className="text-sm text-zinc-500">Could not load metrics.</p>
      </div>
    );
  }

  const hasAnyData = (m: (typeof metrics)[number]) =>
    m.today != null || m.avg7d != null || m.avg30d != null || m.avg90d != null;

  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden">
      {/* Table header */}
      <div className="hidden md:grid grid-cols-[2fr_80px_80px_80px_80px_20px] gap-2 px-5 py-2.5 border-b border-zinc-800 bg-zinc-950/40">
        <span className="text-xs font-medium text-zinc-500">Metric</span>
        <span className="text-xs font-medium text-zinc-500 text-right">Today</span>
        <span className="text-xs font-medium text-zinc-500 text-right">7d avg</span>
        <span className="text-xs font-medium text-zinc-500 text-right">30d avg</span>
        <span className="text-xs font-medium text-zinc-500 text-right">90d avg</span>
        <span />
      </div>

      {/* Rows */}
      {metrics.map((m, i) => {
        const noData = !hasAnyData(m);
        const trendIcon = m.trend === "up" ? TrendingUp : m.trend === "down" ? TrendingDown : Minus;
        const TrendIcon = trendIcon;
        const trendColor = m.trend === "up" ? "text-emerald-400" : m.trend === "down" ? "text-red-400" : "text-zinc-600";

        return (
          <div
            key={m.metricId}
            className={`grid grid-cols-[1fr_auto] md:grid-cols-[2fr_80px_80px_80px_80px_20px] gap-2 items-center px-5 py-3 ${i % 2 === 0 ? "" : "bg-zinc-950/40"} ${i > 0 ? "border-t border-zinc-800/50" : ""} ${noData ? "opacity-50" : ""}`}
          >
            {/* Name + description */}
            <div>
              <p className="text-sm font-medium text-zinc-200">{m.name}</p>
              <p className="text-xs text-zinc-500 mt-0.5 hidden md:block truncate max-w-xs">{m.description}</p>
            </div>

            {/* Mobile: show today value + trend */}
            <div className="flex items-center gap-2 md:hidden text-right">
              <span className={`text-sm font-semibold tabular-nums ${noData ? "text-zinc-600" : "text-zinc-200"}`}>
                {m.formatted.today ?? m.formatted.avg7d ?? "—"}
              </span>
              {m.trend && <TrendIcon className={`w-3 h-3 ${trendColor}`} />}
            </div>

            {/* Desktop: individual columns */}
            <span className="hidden md:block text-sm tabular-nums text-zinc-300 text-right">
              {m.formatted.today ?? "—"}
            </span>
            <span className="hidden md:block text-sm tabular-nums text-zinc-400 text-right">
              {m.formatted.avg7d ?? "—"}
            </span>
            <span className="hidden md:block text-sm tabular-nums text-zinc-400 text-right">
              {m.formatted.avg30d ?? "—"}
            </span>
            <span className="hidden md:block text-sm tabular-nums text-zinc-500 text-right">
              {m.formatted.avg90d ?? "—"}
            </span>
            <div className="hidden md:flex items-center justify-end gap-1">
              <HealthDot value={m.avg30d} healthyRange={m.healthyRange} />
              {m.trend && <TrendIcon className={`w-3 h-3 ${trendColor}`} />}
            </div>
          </div>
        );
      })}
    </div>
  );
}
