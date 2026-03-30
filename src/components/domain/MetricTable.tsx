"use client";

import { LineChart, Line } from "recharts";
import { useDomainMetrics } from "@/hooks/useDomainMetrics";
import { useDomainSeries } from "@/hooks/useDomainSeries";
import { getMetricById } from "@/lib/metrics/registry";
import { DOMAIN_CHART_COLORS } from "@/lib/metrics/domains";
import { TrendingUp, TrendingDown, Minus } from "lucide-react";
import type { Domain } from "@/lib/analysis/domains";
import type { DomainMetricData } from "@/hooks/useDomainMetrics";
import type { SeriesPoint } from "@/lib/metrics/fetch-series";

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

function Sparkline({ data, color }: { data: SeriesPoint[]; color: string }) {
  const valid = data.filter((d) => d.value !== null);
  if (valid.length < 2) return <span className="w-[80px] h-6 inline-block" />;
  return (
    <LineChart width={80} height={24} data={data} margin={{ top: 2, right: 2, bottom: 2, left: 2 }}>
      <Line
        type="monotone"
        dataKey="value"
        stroke={color}
        strokeWidth={1.5}
        dot={false}
        connectNulls
        isAnimationActive={false}
      />
    </LineChart>
  );
}

interface MetricTableProps {
  domain: Domain;
}

export function MetricTable({ domain }: MetricTableProps) {
  const { metrics, loading, error } = useDomainMetrics(domain);
  const { series, loading: seriesLoading } = useDomainSeries(domain);
  const domainColor = DOMAIN_CHART_COLORS[domain] ?? "#a1a1aa";

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
    return "—";
  }

  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden">
      {/* Table header */}
      <div className="hidden md:grid grid-cols-[2fr_80px_80px_80px_80px_80px_20px] gap-4 px-5 py-2.5 border-b border-zinc-800 bg-zinc-950/40">
        <span className="text-xs font-medium text-zinc-500 pr-4">Metric</span>
        <span className="text-xs font-medium text-zinc-500">7d trend</span>
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
        const sparkData = series[m.metricId] ?? [];

        return (
          <div
            key={m.metricId}
            className={`grid grid-cols-[1fr_auto] md:grid-cols-[2fr_80px_80px_80px_80px_80px_20px] gap-4 items-center px-5 py-3 ${i % 2 === 0 ? "" : "bg-zinc-950/40"} ${i > 0 ? "border-t border-zinc-800/50" : ""}`}
          >
            {/* Name + description */}
            <div className="pr-4">
              <p className={`text-sm font-medium ${noData ? "text-zinc-500" : "text-zinc-100"}`}>{m.name}</p>
              <p className="text-xs text-zinc-500 mt-0.5 hidden md:block truncate max-w-xs">{m.description}</p>
            </div>

            {/* Mobile: show today value + trend */}
            <div className="flex items-center gap-2 md:hidden text-right">
              {noData ? (
                <span className="text-xs text-zinc-500 italic">No data</span>
              ) : (
                <>
                  <span className="text-sm font-semibold tabular-nums text-blue-500">
                    {m.formatted.today ?? m.formatted.avg7d ?? emptyCell(m)}
                  </span>
                  {m.trend && <TrendIcon className={`w-3 h-3 ${trendColor}`} />}
                </>
              )}
            </div>

            {/* Sparkline (desktop only) */}
            <div className="hidden md:flex items-center">
              {!seriesLoading && sparkData.length > 0 && (
                <Sparkline data={sparkData} color={domainColor} />
              )}
            </div>

            {/* Desktop: individual columns */}
            <span className={`hidden md:block text-sm tabular-nums text-right ${m.formatted.today == null ? "text-zinc-600 italic text-xs" : "text-blue-500"}`}>
              {m.formatted.today ?? (noData ? "No data" : emptyCell(m))}
            </span>
            <span className={`hidden md:block text-sm tabular-nums text-right ${m.formatted.avg7d == null ? "text-zinc-600" : "text-zinc-300"}`}>
              {m.formatted.avg7d ?? emptyCell(m)}
            </span>
            <span className={`hidden md:block text-sm tabular-nums text-right ${m.formatted.avg30d == null ? "text-zinc-600" : "text-zinc-300"}`}>
              {m.formatted.avg30d ?? emptyCell(m)}
            </span>
            <span className={`hidden md:block text-sm tabular-nums text-right ${m.formatted.avg90d == null ? "text-zinc-600" : "text-zinc-300"}`}>
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
