import { cn } from "@/lib/utils/cn";
import type { InsightCategory } from "@/types/index";

const CATEGORY_STYLES: Record<InsightCategory, string> = {
  sleep: "bg-blue-500/15 text-blue-400 ring-blue-500/20",
  fitness: "bg-orange-500/15 text-orange-400 ring-orange-500/20",
  recovery: "bg-green-500/15 text-green-400 ring-green-500/20",
  correlation: "bg-purple-500/15 text-purple-400 ring-purple-500/20",
  goal: "bg-amber-500/15 text-amber-400 ring-amber-500/20",
  general: "bg-zinc-500/15 text-zinc-400 ring-zinc-500/20",
};

const CATEGORY_LABELS: Record<InsightCategory, string> = {
  sleep: "Sleep",
  fitness: "Fitness",
  recovery: "Recovery",
  correlation: "Correlation",
  goal: "Goal",
  general: "General",
};

interface BadgeProps {
  category: InsightCategory;
  className?: string;
}

export function CategoryBadge({ category, className }: BadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset",
        CATEGORY_STYLES[category],
        className
      )}
    >
      {CATEGORY_LABELS[category]}
    </span>
  );
}
