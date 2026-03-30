"use client";

import {
  LineChart, BarChart, AreaChart,
  Line, Bar, Area,
  XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Legend,
} from "recharts";
import { format, parseISO } from "date-fns";
import { DOMAIN_CHART_COLORS } from "@/lib/metrics/domains";
import { getMetricById } from "@/lib/metrics/registry";
import type { SeriesPoint } from "@/lib/metrics/fetch-series";

export type ChartType = "line" | "bar" | "area";

export function getDomainColor(domainId: string): string {
  return DOMAIN_CHART_COLORS[domainId] ?? "#a1a1aa";
}

interface GraphChartProps {
  metricIds: string[];
  domainIds: string[];
  seriesData: Record<string, SeriesPoint[]>;
  chartType: ChartType;
  days: 7 | 30 | 90;
  height?: number;
  onDaysChange?: (d: 7 | 30 | 90) => void;
}

export function GraphChart({ metricIds, domainIds, seriesData, chartType, days, height = 200, onDaysChange }: GraphChartProps) {
  const dateSet = new Set<string>();
  for (const id of metricIds) {
    for (const pt of seriesData[id] ?? []) dateSet.add(pt.date);
  }

  const chartData = Array.from(dateSet).sort().map((date) => {
    const entry: Record<string, string | number | null> = {
      date,
      label: format(parseISO(date), "MMM d"),
    };
    for (const id of metricIds) {
      const pt = (seriesData[id] ?? []).find((p) => p.date === date);
      entry[id] = pt?.value ?? null;
    }
    return entry;
  });

  const colors = metricIds.map((id, i) => {
    const base = getDomainColor(domainIds[i] ?? "sleep");
    // Second metric from same domain: 60% opacity via hex suffix
    const prevSameDomain = i > 0 && domainIds[i] === domainIds[i - 1];
    return prevSameDomain ? `${base}99` : base;
  });
  const units = metricIds.map((id) => getMetricById(id)?.unitLabel ?? "");
  const names = metricIds.map((id) => getMetricById(id)?.shortName ?? id);
  const dualAxis = metricIds.length === 2 && units[0] !== units[1];
  const isBinary = metricIds.every((id) => getMetricById(id)?.inputType === "toggle");

  const commonProps = {
    data: chartData,
    margin: { top: 5, right: dualAxis ? 40 : 20, bottom: 20, left: 10 },
  };

  const xAxis = (
    <XAxis
      dataKey="label"
      tick={{ fill: "#a1a1aa", fontSize: 11 }}
      axisLine={false}
      tickLine={false}
      interval={days === 90 ? 13 : days === 30 ? 5 : 0}
    />
  );

  const yAxes = isBinary
    ? [<YAxis key="left" yAxisId={0} domain={[0, 1]} ticks={[0, 1]} tickFormatter={(v: number) => (v === 0 ? "No" : "Yes")} tick={{ fill: "#a1a1aa", fontSize: 11 }} axisLine={false} tickLine={false} width={36} />]
    : dualAxis
    ? [
        <YAxis key="left" yAxisId={0} orientation="left" domain={["auto", "auto"]} tick={{ fill: "#a1a1aa", fontSize: 11 }} axisLine={false} tickLine={false} width={36} />,
        <YAxis key="right" yAxisId={1} orientation="right" domain={["auto", "auto"]} tick={{ fill: "#a1a1aa", fontSize: 11 }} axisLine={false} tickLine={false} width={36} />,
      ]
    : [<YAxis key="left" yAxisId={0} domain={["auto", "auto"]} tick={{ fill: "#a1a1aa", fontSize: 11 }} axisLine={false} tickLine={false} width={36} />];

  const tooltipEl = (
    <Tooltip
      isAnimationActive={false}
      offset={15}
      contentStyle={{ background: "#27272a", border: "1px solid #3f3f46", borderRadius: 8, color: "#fafafa", fontSize: 12 }}
      labelStyle={{ color: "#a1a1aa", marginBottom: 4 }}
      formatter={(value, name) => {
        const num = typeof value === "number" ? value : null;
        const nameStr = String(name ?? "");
        if (num == null) return ["—", nameStr];
        const idx = metricIds.indexOf(nameStr);
        const metric = getMetricById(nameStr);
        return [metric ? metric.format(num) : String(num), names[idx] ?? nameStr];
      }}
    />
  );

  const grid = <CartesianGrid strokeDasharray="3 3" stroke="#27272a" vertical={false} />;
  const legendEl = metricIds.length > 1
    ? <Legend formatter={(value: string) => { const idx = metricIds.indexOf(value); return names[idx] ?? value; }} wrapperStyle={{ fontSize: 11, color: "#a1a1aa" }} />
    : null;

  // Sparse data hint: if < 25% coverage and there's a shorter range to suggest
  const actualDays = dateSet.size;
  const coverage = days > 0 ? actualDays / days : 1;
  const suggestedDays: 7 | 30 | 90 = days === 90 ? (actualDays > 15 ? 30 : 7) : 7;
  const showHint = coverage < 0.25 && days > 7 && onDaysChange != null && actualDays > 0;
  const hint = showHint ? (
    <p className="text-xs text-zinc-500 mt-2 text-center">
      Showing {days}d — you have {actualDays} day{actualDays !== 1 ? "s" : ""} of data.{" "}
      <button
        onClick={() => onDaysChange!(suggestedDays)}
        className="text-blue-400 hover:text-blue-300 underline underline-offset-2"
      >
        Try {suggestedDays}d?
      </button>
    </p>
  ) : null;

  if (chartType === "bar") {
    return (
      <>
        <ResponsiveContainer width="100%" height={height}>
          <BarChart {...commonProps}>
            {grid}{xAxis}{yAxes}{tooltipEl}{legendEl}
            {metricIds.map((id, i) => (
              <Bar key={id} yAxisId={dualAxis ? i : 0} dataKey={id} fill={colors[i]} radius={[3, 3, 0, 0]} maxBarSize={32} />
            ))}
          </BarChart>
        </ResponsiveContainer>
        {hint}
      </>
    );
  }

  if (chartType === "area") {
    return (
      <>
        <ResponsiveContainer width="100%" height={height}>
          <AreaChart {...commonProps}>
            {grid}{xAxis}{yAxes}{tooltipEl}{legendEl}
            {metricIds.map((id, i) => (
              <Area key={id} yAxisId={dualAxis ? i : 0} type="monotone" dataKey={id} stroke={colors[i]} fill={`${colors[i]}33`} strokeWidth={2} dot={false} connectNulls />
            ))}
          </AreaChart>
        </ResponsiveContainer>
        {hint}
      </>
    );
  }

  return (
    <>
      <ResponsiveContainer width="100%" height={height}>
        <LineChart {...commonProps}>
          {grid}{xAxis}{yAxes}{tooltipEl}{legendEl}
          {metricIds.map((id, i) => (
            <Line key={id} yAxisId={dualAxis ? i : 0} type="monotone" dataKey={id} stroke={colors[i]} strokeWidth={2} dot={{ r: 3, fill: colors[i], strokeWidth: 0 }} activeDot={{ r: 5, strokeWidth: 2, stroke: colors[i] }} connectNulls />
          ))}
        </LineChart>
      </ResponsiveContainer>
      {hint}
    </>
  );
}
