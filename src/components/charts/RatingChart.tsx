"use client";

import { useState } from "react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

interface RatingDataPoint {
  date: string;
  label: string;
  rapid: number | null;
  blitz: number | null;
  bullet: number | null;
}

interface RatingChartProps {
  data: RatingDataPoint[];
}

const TIME_CLASSES = [
  { key: "rapid" as const, label: "Rapid", color: "#22d3ee" },
  { key: "blitz" as const, label: "Blitz", color: "#f59e0b" },
  { key: "bullet" as const, label: "Bullet", color: "#ef4444" },
];

interface TooltipPayloadItem {
  dataKey: string;
  value: number;
  color: string;
  name: string;
}

function CustomTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: TooltipPayloadItem[];
  label?: string;
}) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-xs">
      <p className="text-zinc-400 mb-1">{label}</p>
      {payload.map((p) => (
        <p key={p.dataKey} className="font-semibold" style={{ color: p.color }}>
          {p.name}: {p.value}
        </p>
      ))}
    </div>
  );
}

export function RatingChart({ data }: RatingChartProps) {
  const [visible, setVisible] = useState<Record<string, boolean>>({
    rapid: true,
    blitz: true,
    bullet: true,
  });

  // Only show toggles for time classes that have data
  const hasData = {
    rapid: data.some((d) => d.rapid !== null),
    blitz: data.some((d) => d.blitz !== null),
    bullet: data.some((d) => d.bullet !== null),
  };

  return (
    <div>
      <div className="flex items-center gap-3 mb-4">
        {TIME_CLASSES.filter((tc) => hasData[tc.key]).map((tc) => (
          <button
            key={tc.key}
            onClick={() => setVisible((v) => ({ ...v, [tc.key]: !v[tc.key] }))}
            className={`flex items-center gap-1.5 text-xs font-medium transition-opacity ${
              visible[tc.key] ? "opacity-100" : "opacity-40"
            }`}
          >
            <span
              className="w-2.5 h-2.5 rounded-full"
              style={{ backgroundColor: tc.color }}
            />
            {tc.label}
          </button>
        ))}
      </div>
      <ResponsiveContainer width="100%" height={220}>
        <LineChart data={data}>
          <CartesianGrid vertical={false} stroke="#27272a" />
          <XAxis
            dataKey="label"
            tick={{ fill: "#71717a", fontSize: 11 }}
            axisLine={false}
            tickLine={false}
          />
          <YAxis
            tick={{ fill: "#71717a", fontSize: 11 }}
            axisLine={false}
            tickLine={false}
            width={40}
            domain={["auto", "auto"]}
          />
          <Tooltip content={<CustomTooltip />} />
          {TIME_CLASSES.map((tc) =>
            visible[tc.key] && hasData[tc.key] ? (
              <Line
                key={tc.key}
                type="monotone"
                dataKey={tc.key}
                name={tc.label}
                stroke={tc.color}
                strokeWidth={2}
                dot={false}
                connectNulls
              />
            ) : null
          )}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
