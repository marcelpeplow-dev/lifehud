"use client";

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from "recharts";
import { formatChartLabel } from "@/lib/utils/dates";
import type { WorkoutChartDataPoint } from "@/types/index";

interface ActivityChartProps {
  data: WorkoutChartDataPoint[];
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
  if (!active || !payload?.length || !payload[0].value) return null;
  const minutes = payload[0].value;
  return (
    <div className="bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-xs">
      <p className="text-zinc-400 mb-0.5">{label}</p>
      <p className="text-zinc-50 font-semibold">{minutes} min</p>
    </div>
  );
}

export function ActivityChart({ data }: ActivityChartProps) {
  const chartData = data.map((d) => ({
    date: formatChartLabel(d.date),
    minutes: d.duration_minutes,
    hasWorkout: d.workouts > 0,
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
          tickFormatter={(v: number) => `${v}m`}
          tick={{ fill: "#71717a", fontSize: 11 }}
          axisLine={false}
          tickLine={false}
          width={32}
        />
        <Tooltip content={<CustomTooltip />} cursor={{ fill: "#27272a" }} />
        <Bar dataKey="minutes" radius={[4, 4, 0, 0]}>
          {chartData.map((entry, i) => (
            <Cell
              key={i}
              fill={entry.hasWorkout ? "#f97316" : "#27272a"}
            />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
