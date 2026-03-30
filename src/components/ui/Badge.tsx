import { cn } from "@/lib/utils/cn";
import {
  Moon, Dumbbell, Crown, Heart, Activity,
  Share2, Sparkles, Target,
} from "lucide-react";
import type { InsightCategory, InsightRarity } from "@/types/index";

// ── Domain icons — lucide-react, matching sidebar/stat card icon set ──────────

const CATEGORY_ICON: Record<InsightCategory, React.ComponentType<{ size?: number; color?: string; strokeWidth?: number }>> = {
  sleep:       Moon,
  fitness:     Dumbbell,
  chess:       Crown,
  wellbeing:   Heart,
  recovery:    Activity,
  correlation: Share2,
  goal:        Target,
  general:     Sparkles,
};

export function DomainIcon({
  category, legendary, className, size = 14, active,
}: {
  category: InsightCategory;
  legendary?: boolean;
  className?: string;
  size?: number;
  active?: boolean;
}) {
  const Icon = CATEGORY_ICON[category] ?? Sparkles;
  const color = active ? "#ffffff" : legendary ? "#CA8A04" : "#71717a";
  return (
    <span
      className={cn("inline-flex items-center justify-center shrink-0", className)}
      style={{ background: "rgba(161,161,170,0.08)", borderRadius: 3, padding: 3 }}
    >
      <Icon size={size} color={color} strokeWidth={1.5} />
    </span>
  );
}

/** Render multiple domain icons side-by-side for multi-domain insights. */
export function MultiDomainIcons({
  domains,
  legendary,
  className,
}: {
  domains: InsightCategory[];
  legendary?: boolean;
  className?: string;
}) {
  if (domains.length === 0) return null;
  return (
    <span className={cn("inline-flex items-center gap-0.5", className)}>
      {domains.map((d) => (
        <DomainIcon key={d} category={d} legendary={legendary} />
      ))}
    </span>
  );
}

const RARITY_STYLES: Record<InsightRarity, string> = {
  common:    "bg-zinc-700/50 text-zinc-400 ring-zinc-600/30",
  uncommon:  "bg-green-900/40 text-green-300 ring-green-700/30",
  rare:      "bg-blue-900/40 text-blue-300 ring-blue-700/30",
  epic:      "bg-purple-900/40 text-violet-300 ring-purple-700/30",
  legendary: "bg-amber-900/40 text-amber-200 ring-amber-600/30",
};

const RARITY_LABELS: Record<InsightRarity, string> = {
  common:    "Common",
  uncommon:  "Uncommon",
  rare:      "Rare",
  epic:      "Epic",
  legendary: "Legendary",
};

export function RarityBadge({ rarity, className }: { rarity: InsightRarity; className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold ring-1 ring-inset tracking-wide",
        RARITY_STYLES[rarity],
        className
      )}
    >
      {RARITY_LABELS[rarity]}
    </span>
  );
}

const CATEGORY_STYLES: Record<InsightCategory, string> = {
  sleep: "bg-blue-500/15 text-blue-400 ring-blue-500/20",
  fitness: "bg-orange-500/15 text-orange-400 ring-orange-500/20",
  recovery: "bg-green-500/15 text-green-400 ring-green-500/20",
  correlation: "bg-purple-500/15 text-purple-400 ring-purple-500/20",
  goal: "bg-amber-500/15 text-amber-400 ring-amber-500/20",
  general: "bg-zinc-500/15 text-zinc-400 ring-zinc-500/20",
  wellbeing: "bg-blue-500/15 text-blue-400 ring-blue-500/20",
  chess: "bg-cyan-500/15 text-cyan-400 ring-cyan-500/20",
};

const CATEGORY_LABELS: Record<InsightCategory, string> = {
  sleep: "Sleep",
  fitness: "Fitness",
  recovery: "Recovery",
  correlation: "Correlation",
  goal: "Goal",
  general: "General",
  wellbeing: "Wellbeing",
  chess: "Chess",
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
