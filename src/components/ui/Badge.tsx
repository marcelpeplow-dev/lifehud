import { cn } from "@/lib/utils/cn";
import type { InsightCategory, InsightRarity } from "@/types/index";

// ── Domain icons (inline SVGs, 14–15px) ──────────────────────────────────────

function DomainIconSvg({ category, legendary }: { category: InsightCategory; legendary?: boolean }) {
  const stroke = legendary ? "#CA8A04" : "#52525B";
  const size = 14;
  const shared = { width: size, height: size, viewBox: "0 0 16 16", fill: "none", stroke, strokeWidth: 1.5, strokeLinecap: "round" as const, strokeLinejoin: "round" as const };

  switch (category) {
    case "fitness":
      // Dumbbell
      return (
        <svg {...shared}>
          <circle cx="3" cy="8" r="2" /><circle cx="13" cy="8" r="2" />
          <line x1="5" y1="8" x2="11" y2="8" />
        </svg>
      );
    case "sleep":
      // Crescent moon
      return (
        <svg {...shared}>
          <path d="M12 3a6 6 0 1 0 0 10A5 5 0 0 1 12 3z" />
        </svg>
      );
    case "recovery":
      // Heart with pulse
      return (
        <svg {...shared}>
          <path d="M8 14s-5.5-4-5.5-7.5A3 3 0 0 1 8 4a3 3 0 0 1 5.5 2.5c0 1.5-1.2 3-2.5 4.5" />
          <polyline points="1,9 5,9 6.5,7 8.5,11 10,9 15,9" />
        </svg>
      );
    case "wellbeing":
      // Leaf
      return (
        <svg {...shared}>
          <path d="M3 13c0-6 4-10 10-10 0 6-4 10-10 10z" />
          <path d="M3 13C5 11 7 9 13 3" />
        </svg>
      );
    case "chess":
      // Crossed swords
      return (
        <svg {...shared}>
          <line x1="3" y1="3" x2="13" y2="13" />
          <polyline points="10,3 13,3 13,6" />
          <line x1="13" y1="3" x2="3" y2="13" />
          <polyline points="3,10 3,13 6,13" />
        </svg>
      );
    case "correlation":
      // Two overlapping circles
      return (
        <svg {...shared}>
          <circle cx="6" cy="8" r="4" /><circle cx="10" cy="8" r="4" />
        </svg>
      );
    default:
      // Sparkle (general/goal)
      return (
        <svg {...shared}>
          <path d="M8 1v3M8 12v3M1 8h3M12 8h3M3.5 3.5l2 2M10.5 10.5l2 2M12.5 3.5l-2 2M5.5 10.5l-2 2" />
        </svg>
      );
  }
}

export function DomainIcon({ category, legendary, className }: { category: InsightCategory; legendary?: boolean; className?: string }) {
  return (
    <span
      className={cn("inline-flex items-center justify-center shrink-0", className)}
      style={{ background: "rgba(161,161,170,0.08)", borderRadius: 3, padding: 3 }}
    >
      <DomainIconSvg category={category} legendary={legendary} />
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
  wellbeing: "bg-emerald-500/15 text-emerald-400 ring-emerald-500/20",
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
