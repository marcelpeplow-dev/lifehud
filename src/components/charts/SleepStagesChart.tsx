"use client";

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import { formatChartLabel, formatShortDate } from "@/lib/utils/dates";
import type { SleepStagesDataPoint } from "@/types/index";

interface SleepStagesChartProps {
  data: SleepStagesDataPoint[];
  showShortDate?: boolean;
}

interface TooltipPayload {
  name: string;
  value: number;
  color: string;
}

function fmt(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h === 0) return `${m}m`;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}m`;
}

function CustomTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: TooltipPayload[];
  label?: string;
}) {
  if (!active || !payload?.length) return null;
  const total = payload.reduce((s, p) => s + p.value, 0);
  return (
    <div className="bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-xs space-y-1 min-w-[120px]">
      <p className="text-zinc-400 mb-1">{label}</p>
      {payload.map((p) => (
        <div key={p.name} className="flex items-center justify-between gap-4">
          <span style={{ color: p.color }}>{p.name}</span>
          <span className="text-zinc-50 font-semibold tabular-nums">{fmt(p.value)}</span>
        </div>
      ))}
      <div className="flex items-center justify-between gap-4 border-t border-zinc-700 pt-1 mt-1">
        <span className="text-zinc-400">Total</span>
        <span className="text-zinc-50 font-semibold tabular-nums">{fmt(total)}</span>
      </div>
    </div>
  );
}

export function SleepStagesChart({ data, showShortDate = false }: SleepStagesChartProps) {
  const chartData = data.map((d) => ({
    date: showShortDate ? formatShortDate(d.date) : formatChartLabel(d.date),
    Deep: d.deep_minutes,
    REM: d.rem_minutes,
    Light: d.light_minutes,
    Awake: d.awake_minutes,
  }));

  return (
    <ResponsiveContainer width="100%" height={220}>
      <BarChart data={chartData} barCategoryGap="30%">
        <CartesianGrid vertical={false} stroke="#27272a" />
        <XAxis
          dataKey="date"
          tick={{ fill: "#71717a", fontSize: 11 }}
          axisLine={false}
          tickLine={false}
        />
        <YAxis
          tickFormatter={(v: number) => `${Math.round(v / 60)}h`}
          tick={{ fill: "#71717a", fontSize: 11 }}
          axisLine={false}
          tickLine={false}
          width={28}
        />
        <Tooltip content={<CustomTooltip />} cursor={{ fill: "#27272a" }} />
        <Legend
          wrapperStyle={{ fontSize: 11, color: "#71717a", paddingTop: 8 }}
          iconType="square"
          iconSize={8}
        />
        <Bar dataKey="Deep" stackId="sleep" fill="#1d4ed8" radius={[0, 0, 0, 0]} />
        <Bar dataKey="REM" stackId="sleep" fill="#3b82f6" radius={[0, 0, 0, 0]} />
        <Bar dataKey="Light" stackId="sleep" fill="#93c5fd" radius={[0, 0, 0, 0]} />
        <Bar dataKey="Awake" stackId="sleep" fill="#3f3f46" radius={[4, 4, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}
