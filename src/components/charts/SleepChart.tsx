"use client";

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ReferenceLine,
  ResponsiveContainer,
  Cell,
} from "recharts";
import { formatChartLabel } from "@/lib/utils/dates";
import type { SleepChartDataPoint } from "@/types/index";

interface SleepChartProps {
  data: SleepChartDataPoint[];
  goalMinutes?: number;
}

interface TooltipPayload {
  value: number;
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
  const minutes = payload[0].value;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return (
    <div className="bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-xs">
      <p className="text-zinc-400 mb-0.5">{label}</p>
      <p className="text-zinc-50 font-semibold">
        {h}h {m > 0 ? `${m}m` : ""}
      </p>
    </div>
  );
}

export function SleepChart({ data, goalMinutes = 420 }: SleepChartProps) {
  const chartData = data.map((d) => ({
    date: formatChartLabel(d.date),
    minutes: d.duration_minutes,
  }));

  return (
    <ResponsiveContainer width="100%" height={180}>
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
          domain={[0, "auto"]}
          width={28}
        />
        <Tooltip content={<CustomTooltip />} cursor={{ fill: "#27272a" }} />
        <ReferenceLine
          y={goalMinutes}
          stroke="#34d399"
          strokeDasharray="4 3"
          strokeWidth={1.5}
        />
        <Bar dataKey="minutes" radius={[4, 4, 0, 0]}>
          {chartData.map((entry, i) => (
            <Cell
              key={i}
              fill={entry.minutes >= goalMinutes ? "#34d399" : "#3f3f46"}
            />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
