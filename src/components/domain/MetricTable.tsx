"use client";

import { useDomainMetrics } from "@/hooks/useDomainMetrics";
import { getMetricById } from "@/lib/metrics/registry";
import { TrendingUp, TrendingDown, Minus } from "lucide-react";
import type { Domain } from "@/lib/analysis/domains";
import type { DomainMetricData } from "@/hooks/useDomainMetrics";

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

  function emptyCell(m: DomainMetricData): string {
    const inputType = getMetricById(m.metricId)?.inputType;
    if (inputType === "time") return "—:—";
    return m.unitLabel ? `— ${m.unitLabel}` : "—";
  }

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
        const trendColor = m.trend === "up" ? "text-blue-400" : m.trend === "down" ? "text-red-400" : "text-zinc-600";

        return (
          <div
            key={m.metricId}
            className={`grid grid-cols-[1fr_auto] md:grid-cols-[2fr_80px_80px_80px_80px_20px] gap-2 items-center px-5 py-3 ${i % 2 === 0 ? "" : "bg-zinc-950/40"} ${i > 0 ? "border-t border-zinc-800/50" : ""}`}
          >
            {/* Name + description */}
            <div>
              <p className={`text-sm font-medium ${noData ? "text-zinc-500" : "text-zinc-200"}`}>{m.name}</p>
              <p className="text-xs text-zinc-500 mt-0.5 hidden md:block truncate max-w-xs">{m.description}</p>
            </div>

            {/* Mobile: show today value + trend */}
            <div className="flex items-center gap-2 md:hidden text-right">
              {noData ? (
                <span className="text-xs text-zinc-500 italic">No data</span>
              ) : (
                <>
                  <span className="text-sm font-semibold tabular-nums text-zinc-200">
                    {m.formatted.today ?? m.formatted.avg7d ?? emptyCell(m)}
                  </span>
                  {m.trend && <TrendIcon className={`w-3 h-3 ${trendColor}`} />}
                </>
              )}
            </div>

            {/* Desktop: individual columns */}
            <span className={`hidden md:block text-sm tabular-nums text-right ${m.formatted.today == null ? "text-zinc-600 italic text-xs" : "text-zinc-300"}`}>
              {m.formatted.today ?? (noData ? "No data" : emptyCell(m))}
            </span>
            <span className={`hidden md:block text-sm tabular-nums text-right ${m.formatted.avg7d == null ? "text-zinc-600" : "text-zinc-400"}`}>
              {m.formatted.avg7d ?? emptyCell(m)}
            </span>
            <span className={`hidden md:block text-sm tabular-nums text-right ${m.formatted.avg30d == null ? "text-zinc-600" : "text-zinc-400"}`}>
              {m.formatted.avg30d ?? emptyCell(m)}
            </span>
            <span className={`hidden md:block text-sm tabular-nums text-right ${m.formatted.avg90d == null ? "text-zinc-600" : "text-zinc-500"}`}>
              {m.formatted.avg90d ?? emptyCell(m)}
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
