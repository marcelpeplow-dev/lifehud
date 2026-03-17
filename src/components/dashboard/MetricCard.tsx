import { TrendIndicator } from "./TrendIndicator";
import type { TrendDirection } from "@/types/index";

interface MetricCardProps {
  label: string;
  value: string;
  trend: TrendDirection;
  trendLabel: string;
  trendPositive: boolean;
  icon?: React.ComponentType<{ className?: string }>;
  /** Optional SVG progress ring for the workout card */
  ring?: { current: number; target: number };
}

function ProgressRing({ current, target }: { current: number; target: number }) {
  const radius = 14;
  const circumference = 2 * Math.PI * radius;
  const pct = Math.min(current / Math.max(target, 1), 1);
  const filled = circumference * pct;

  return (
    <svg width="36" height="36" viewBox="0 0 36 36" className="shrink-0">
      <circle
        cx="18" cy="18" r={radius}
        fill="none" stroke="#27272a" strokeWidth="3"
      />
      <circle
        cx="18" cy="18" r={radius}
        fill="none" stroke="#34d399" strokeWidth="3"
        strokeLinecap="round"
        strokeDasharray={`${filled} ${circumference}`}
        transform="rotate(-90 18 18)"
      />
      <text
        x="18" y="22"
        textAnchor="middle"
        fontSize="9"
        fontWeight="600"
        fill="#f4f4f5"
      >
        {current}/{target}
      </text>
    </svg>
  );
}

export function MetricCard({
  label,
  value,
  trend,
  trendLabel,
  trendPositive,
  icon: Icon,
  ring,
}: MetricCardProps) {
  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5">
      <div className="flex items-start justify-between mb-3">
        <span className="text-xs font-medium text-zinc-400 leading-tight">{label}</span>
        {ring ? (
          <ProgressRing current={ring.current} target={ring.target} />
        ) : Icon ? (
          <Icon className="w-4 h-4 text-zinc-600 shrink-0" />
        ) : null}
      </div>
      <div className="text-2xl font-semibold text-zinc-50 tabular-nums mb-1">
        {value}
      </div>
      <TrendIndicator direction={trend} label={trendLabel} positive={trendPositive} />
    </div>
  );
}
