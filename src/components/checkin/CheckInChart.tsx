"use client";

import { useState } from "react";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, ReferenceLine,
} from "recharts";
import { format, parseISO } from "date-fns";
import type { CheckIn } from "@/types/index";

interface DataPoint {
  date: string;
  label: string;
  mood: number;
  energy: number;
  stress: number;
}

const LINES = [
  { key: "mood",   label: "Mood",   color: "#10b981" },
  { key: "energy", label: "Energy", color: "#f59e0b" },
  { key: "stress", label: "Stress", color: "#ef4444" },
] as const;

function CustomTooltip({ active, payload, label }: {
  active?: boolean;
  payload?: { value: number; name: string; color: string }[];
  label?: string;
}) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-zinc-900 border border-zinc-700 rounded-lg px-3 py-2 text-xs shadow-lg">
      <p className="text-zinc-400 mb-1.5">{label}</p>
      {payload.map((p) => (
        <p key={p.name} style={{ color: p.color }} className="font-medium">
          {p.name}: {p.value}/10
        </p>
      ))}
    </div>
  );
}

export function CheckInChart({ checkins, showShortDate = false }: {
  checkins: CheckIn[];
  showShortDate?: boolean;
}) {
  const [hidden, setHidden] = useState<Set<string>>(new Set());

  const data: DataPoint[] = checkins.map((c) => ({
    date: c.date,
    label: showShortDate
      ? format(parseISO(c.date), "MMM d")
      : format(parseISO(c.date), "EEE d"),
    mood: c.mood,
    energy: c.energy,
    stress: c.stress,
  }));

  function toggle(key: string) {
    setHidden((prev) => {
      const next = new Set(prev);
      next.has(key) ? next.delete(key) : next.add(key);
      return next;
    });
  }

  return (
    <div>
      {/* Legend toggles */}
      <div className="flex gap-3 mb-4 flex-wrap">
        {LINES.map(({ key, label, color }) => (
          <button
            key={key}
            onClick={() => toggle(key)}
            className={`flex items-center gap-1.5 text-xs font-medium transition-opacity ${
              hidden.has(key) ? "opacity-30" : "opacity-100"
            }`}
          >
            <span className="w-3 h-3 rounded-full" style={{ background: color }} />
            <span className="text-zinc-300">{label}</span>
          </button>
        ))}
      </div>

      <ResponsiveContainer width="100%" height={220}>
        <LineChart data={data} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#27272a" vertical={false} />
          <XAxis
            dataKey="label"
            tick={{ fill: "#71717a", fontSize: 11 }}
            tickLine={false}
            axisLine={false}
            interval="preserveStartEnd"
          />
          <YAxis
            domain={[1, 10]}
            ticks={[1, 3, 5, 7, 10]}
            tick={{ fill: "#71717a", fontSize: 11 }}
            tickLine={false}
            axisLine={false}
          />
          <Tooltip content={<CustomTooltip />} />
          <ReferenceLine y={5} stroke="#3f3f46" strokeDasharray="3 3" />
          {LINES.map(({ key, color }) => (
            <Line
              key={key}
              type="monotone"
              dataKey={hidden.has(key) ? undefined : key}
              stroke={color}
              strokeWidth={2}
              dot={{ fill: color, r: 3, strokeWidth: 0 }}
              activeDot={{ r: 5, strokeWidth: 0 }}
              connectNulls
            />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
