import { TrendingUp, TrendingDown, Minus } from "lucide-react";
import type { TrendDirection } from "@/types/index";

interface TrendIndicatorProps {
  direction: TrendDirection;
  label: string;
  /** true = "up" is good (sleep duration); false = "up" is bad (resting HR) */
  positive: boolean;
}

export function TrendIndicator({ direction, label, positive }: TrendIndicatorProps) {
  const isGood =
    direction === "flat"
      ? null
      : (direction === "up") === positive;

  const colorClass =
    direction === "flat"
      ? "text-zinc-500"
      : isGood
      ? "text-blue-400"
      : "text-red-400";

  const Icon =
    direction === "up"
      ? TrendingUp
      : direction === "down"
      ? TrendingDown
      : Minus;

  return (
    <span className={`inline-flex items-center gap-1 text-xs font-medium ${colorClass}`}>
      <Icon className="w-3 h-3 shrink-0" />
      {label}
    </span>
  );
}
