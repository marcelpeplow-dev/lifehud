"use client";

import { useRouter, useSearchParams, usePathname } from "next/navigation";
import type { InsightCategory } from "@/types/index";

const CATEGORIES: { label: string; value: InsightCategory | "all" }[] = [
  { label: "All", value: "all" },
  { label: "Sleep", value: "sleep" },
  { label: "Fitness", value: "fitness" },
  { label: "Recovery", value: "recovery" },
  { label: "Wellbeing", value: "wellbeing" },
  { label: "Correlation", value: "correlation" },
  { label: "Goal", value: "goal" },
  { label: "General", value: "general" },
];

const STATUSES = [
  { label: "Active", value: "active" },
  { label: "Unread", value: "unread" },
  { label: "Dismissed", value: "dismissed" },
];

function useParamUpdater() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  return (key: string, value: string) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set(key, value);
    router.push(`${pathname}?${params.toString()}`);
  };
}

export function CategoryFilter({ active }: { active: string }) {
  const update = useParamUpdater();
  return (
    <div className="flex gap-1.5 flex-wrap">
      {CATEGORIES.map((c) => (
        <button
          key={c.value}
          onClick={() => update("category", c.value)}
          className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
            active === c.value
              ? "bg-zinc-700 text-zinc-50"
              : "text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800"
          }`}
        >
          {c.label}
        </button>
      ))}
    </div>
  );
}

export function StatusFilter({ active }: { active: string }) {
  const update = useParamUpdater();
  return (
    <div className="flex gap-1 bg-zinc-800 rounded-lg p-1">
      {STATUSES.map((s) => (
        <button
          key={s.value}
          onClick={() => update("status", s.value)}
          className={`px-3 py-1 rounded-md text-xs font-medium transition-colors ${
            active === s.value
              ? "bg-zinc-700 text-zinc-50"
              : "text-zinc-400 hover:text-zinc-200"
          }`}
        >
          {s.label}
        </button>
      ))}
    </div>
  );
}
