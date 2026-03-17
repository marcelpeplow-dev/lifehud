"use client";

import { useRouter, useSearchParams, usePathname } from "next/navigation";
import type { DateRange } from "@/types/index";

const RANGES: { label: string; value: DateRange }[] = [
  { label: "7D", value: "7d" },
  { label: "30D", value: "30d" },
  { label: "90D", value: "90d" },
];

export function DateRangeSelector({ active }: { active: DateRange }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  function select(range: DateRange) {
    const params = new URLSearchParams(searchParams.toString());
    params.set("range", range);
    router.push(`${pathname}?${params.toString()}`);
  }

  return (
    <div className="flex gap-1 bg-zinc-800 rounded-lg p-1">
      {RANGES.map((r) => (
        <button
          key={r.value}
          onClick={() => select(r.value)}
          className={`px-3 py-1 rounded-md text-xs font-medium transition-colors ${
            active === r.value
              ? "bg-zinc-700 text-zinc-50"
              : "text-zinc-400 hover:text-zinc-200"
          }`}
        >
          {r.label}
        </button>
      ))}
    </div>
  );
}
