"use client";

import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { DomainIcon } from "@/components/ui/Badge";
import type { InsightCategory } from "@/types/index";
import type { Domain } from "@/lib/insights/domains";

const DOMAINS: { label: string; value: Domain; category: InsightCategory }[] = [
  { label: "Sleep",     value: "sleep",     category: "sleep" },
  { label: "Fitness",   value: "fitness",   category: "fitness" },
  { label: "Chess",     value: "chess",     category: "chess" },
  { label: "Wellbeing", value: "wellbeing", category: "wellbeing" },
  { label: "Recovery",  value: "recovery",  category: "recovery" },
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
    if (value) params.set(key, value);
    else params.delete(key);
    router.push(`${pathname}?${params.toString()}`);
  };
}

/** Parse the comma-separated domains param into a Set. */
function parseActiveDomains(raw: string): Set<Domain> {
  if (!raw) return new Set();
  return new Set(raw.split(",").filter(Boolean) as Domain[]);
}

export function DomainFilter({ active }: { active: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const activeDomains = parseActiveDomains(active);
  const isAll = activeDomains.size === 0;

  function toggle(domain: Domain) {
    const next = new Set(activeDomains);
    if (next.has(domain)) next.delete(domain);
    else next.add(domain);

    const params = new URLSearchParams(searchParams.toString());
    // Remove legacy category param
    params.delete("category");
    if (next.size === 0) params.delete("domains");
    else params.set("domains", Array.from(next).join(","));
    router.push(`${pathname}?${params.toString()}`);
  }

  function selectAll() {
    const params = new URLSearchParams(searchParams.toString());
    params.delete("domains");
    params.delete("category");
    router.push(`${pathname}?${params.toString()}`);
  }

  return (
    <div className="flex gap-1.5 flex-wrap">
      {/* All pill */}
      <button
        onClick={selectAll}
        className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
          isAll
            ? "bg-zinc-700 text-zinc-50"
            : "text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800"
        }`}
      >
        All
      </button>

      {/* Domain pills */}
      {DOMAINS.map((d) => {
        const selected = activeDomains.has(d.value);
        return (
          <button
            key={d.value}
            onClick={() => toggle(d.value)}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
              selected
                ? "bg-zinc-700 text-zinc-50"
                : "text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800"
            }`}
          >
            <DomainIcon category={d.category} className={selected ? "" : "opacity-80"} size={12} active={selected} />
            {d.label}
          </button>
        );
      })}
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
