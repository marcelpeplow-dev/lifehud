"use client";

import { useState } from "react";
import { Coffee, Droplets, Monitor, Wine } from "lucide-react";
import type { BucketDomain } from "@/lib/metrics/buckets";

interface DomainConfig {
  icon: React.ComponentType<{ className?: string }>;
  textColor: string;
  bgColor: string;
}

const DOMAIN_CONFIG: Record<string, DomainConfig> = {
  caffeine:    { icon: Coffee,   textColor: "text-orange-400", bgColor: "bg-orange-500/10" },
  substances:  { icon: Wine,     textColor: "text-red-400",    bgColor: "bg-red-500/10"    },
  hydration:   { icon: Droplets, textColor: "text-cyan-400",   bgColor: "bg-cyan-500/10"   },
  screen_time: { icon: Monitor,  textColor: "text-indigo-400", bgColor: "bg-indigo-500/10" },
};

const FALLBACK_CONFIG: DomainConfig = { icon: Coffee, textColor: "text-zinc-400", bgColor: "bg-zinc-700/20" };

interface Props {
  domain: BucketDomain;
  value: number | undefined;
  onChange: (metricId: string, value: number) => void;
}

export function BucketSelector({ domain, value, onChange }: Props) {
  const cfg = DOMAIN_CONFIG[domain.domain] ?? FALLBACK_CONFIG;
  const Icon = cfg.icon;

  // Derive initial state from value prop
  const initIdx = value !== undefined
    ? domain.buckets.findIndex((b) => b.storedValue === value)
    : -1;

  const [selectedIdx, setSelectedIdx] = useState<number | null>(initIdx >= 0 ? initIdx : null);
  const [showExact, setShowExact] = useState(value !== undefined && initIdx < 0);
  const [exactText, setExactText] = useState(() =>
    value !== undefined && initIdx < 0 ? String(value) : ""
  );

  function handleBucketClick(idx: number) {
    setSelectedIdx(idx);
    setShowExact(false);
    setExactText("");
    onChange(domain.metricId, domain.buckets[idx].storedValue);
  }

  function handleExactChange(text: string) {
    setExactText(text);
    setSelectedIdx(null);
    const num = parseFloat(text);
    if (!isNaN(num) && num >= 0) {
      onChange(domain.metricId, num);
    }
  }

  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4 space-y-3 overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-2">
        <div className={`w-7 h-7 rounded-lg flex items-center justify-center ${cfg.bgColor}`}>
          <Icon className={`w-3.5 h-3.5 ${cfg.textColor}`} />
        </div>
        <span className="text-sm font-semibold text-zinc-100">{domain.displayName}</span>
      </div>

      {/* Bucket buttons */}
      <div role="radiogroup" aria-label={domain.displayName} className="flex gap-1.5 min-w-0">
        {domain.buckets.map((bucket, idx) => {
          const isSelected = selectedIdx === idx;
          return (
            <button
              key={idx}
              type="button"
              role="radio"
              aria-checked={isSelected}
              onClick={() => handleBucketClick(idx)}
              className={`flex-1 min-w-0 rounded-lg border px-2 py-2.5 text-left min-h-[48px] transition-all duration-150 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 ${
                isSelected
                  ? "border-blue-500 bg-blue-500/[0.08] scale-[1.02]"
                  : "border-zinc-700/50 hover:border-zinc-600"
              }`}
            >
              <div className="text-xs font-semibold text-zinc-200 mb-0.5 leading-tight">
                {bucket.label}
              </div>
              <div className="text-[10px] text-zinc-500 leading-tight">{bucket.rangeText}</div>
            </button>
          );
        })}
      </div>

      {/* Exact amount option */}
      {!showExact ? (
        <button
          type="button"
          onClick={() => setShowExact(true)}
          className="w-full text-left text-xs text-zinc-500 hover:text-zinc-300 transition-colors py-1"
        >
          Or enter exact amount…
        </button>
      ) : (
        <div className="flex items-center gap-2">
          <input
            type="number"
            min={0}
            step="any"
            value={exactText}
            onChange={(e) => handleExactChange(e.target.value)}
            placeholder="Exact amount"
            autoFocus
            className="flex-1 bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-zinc-100 placeholder-zinc-600 focus:outline-none focus:border-blue-500 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
          />
          <span className="text-sm text-zinc-500 shrink-0">{domain.exactUnit}</span>
          <button
            type="button"
            onClick={() => { setShowExact(false); setExactText(""); }}
            className="text-xs text-zinc-600 hover:text-zinc-400 transition-colors shrink-0"
          >
            Cancel
          </button>
        </div>
      )}
    </div>
  );
}
