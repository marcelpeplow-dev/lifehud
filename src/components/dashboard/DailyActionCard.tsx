"use client";

import { useState } from "react";
import { Zap, RefreshCw } from "lucide-react";
import type { DailyAction } from "@/types/index";

interface DailyActionCardProps {
  initial: DailyAction | null;
}

export function DailyActionCard({ initial }: DailyActionCardProps) {
  const [action, setAction] = useState<DailyAction | null>(initial);
  const [loading, setLoading] = useState(false);

  async function generate() {
    setLoading(true);
    try {
      const res = await fetch("/api/daily-action", { method: "POST" });
      const data = await res.json();
      if (data.text) {
        setAction({ ...action, text: data.text } as DailyAction);
      }
    } catch {
      // silent fail
    } finally {
      setLoading(false);
    }
  }

  if (!action) {
    return (
      <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Zap className="w-4 h-4 text-emerald-400 shrink-0" />
          <p className="text-sm text-zinc-500">No daily action yet — generate insights to unlock coaching.</p>
        </div>
        <button
          onClick={generate}
          disabled={loading}
          className="text-xs text-zinc-400 hover:text-zinc-200 transition-colors disabled:opacity-50 flex items-center gap-1"
        >
          <RefreshCw className={`w-3 h-3 ${loading ? "animate-spin" : ""}`} />
          Generate
        </button>
      </div>
    );
  }

  return (
    <div className="bg-emerald-950/30 border border-emerald-900/50 rounded-xl p-5">
      <div className="flex items-start gap-3">
        <div className="w-7 h-7 rounded-full bg-emerald-500/20 flex items-center justify-center shrink-0 mt-0.5">
          <Zap className="w-3.5 h-3.5 text-emerald-400" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-xs font-semibold text-emerald-400 uppercase tracking-wider mb-1">
            Today&apos;s focus
          </p>
          <p className="text-sm text-zinc-100 leading-relaxed">{action.text}</p>
        </div>
        <button
          onClick={generate}
          disabled={loading}
          className="shrink-0 p-1.5 rounded-md text-zinc-600 hover:text-zinc-400 transition-colors disabled:opacity-50"
          aria-label="Refresh daily action"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
        </button>
      </div>
    </div>
  );
}
