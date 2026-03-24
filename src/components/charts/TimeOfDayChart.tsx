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

interface TimeSlot {
  slot: string;
  winRate: number;
  games: number;
}

interface TimeOfDayChartProps {
  data: TimeSlot[];
}

interface TooltipPayload {
  value: number;
  payload: TimeSlot;
}

function CustomTooltip({
  active,
  payload,
}: {
  active?: boolean;
  payload?: TooltipPayload[];
}) {
  if (!active || !payload?.length) return null;
  const d = payload[0].payload;
  return (
    <div className="bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-xs">
      <p className="text-zinc-400 mb-0.5">{d.slot}</p>
      <p className="text-zinc-50 font-semibold">{d.winRate}% win rate</p>
      <p className="text-zinc-500">{d.games} games</p>
    </div>
  );
}

export function TimeOfDayChart({ data }: TimeOfDayChartProps) {
  return (
    <ResponsiveContainer width="100%" height={180}>
      <BarChart data={data} barCategoryGap="25%">
        <CartesianGrid vertical={false} stroke="#27272a" />
        <XAxis
          dataKey="slot"
          tick={{ fill: "#71717a", fontSize: 11 }}
          axisLine={false}
          tickLine={false}
        />
        <YAxis
          tickFormatter={(v: number) => `${v}%`}
          tick={{ fill: "#71717a", fontSize: 11 }}
          axisLine={false}
          tickLine={false}
          domain={[0, 100]}
          width={36}
        />
        <Tooltip content={<CustomTooltip />} cursor={{ fill: "#27272a" }} />
        <Bar dataKey="winRate" radius={[4, 4, 0, 0]}>
          {data.map((entry, i) => (
            <Cell
              key={i}
              fill={entry.winRate >= 50 ? "#34d399" : "#ef4444"}
            />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
