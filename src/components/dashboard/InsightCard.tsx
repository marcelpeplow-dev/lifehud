"use client";

import { useState } from "react";
import { X } from "lucide-react";
import { formatDistanceToNow, parseISO } from "date-fns";
import { CategoryBadge } from "@/components/ui/Badge";
import { createClient } from "@/lib/supabase/client";
import type { Insight } from "@/types/index";

const BORDER_COLORS: Record<Insight["category"], string> = {
  sleep: "border-blue-500",
  fitness: "border-orange-500",
  recovery: "border-green-500",
  correlation: "border-purple-500",
  goal: "border-amber-500",
  general: "border-zinc-500",
};

interface InsightCardProps {
  insight: Insight;
}

export function InsightCard({ insight }: InsightCardProps) {
  const [dismissed, setDismissed] = useState(false);

  if (dismissed) return null;

  async function handleDismiss() {
    setDismissed(true);
    const supabase = createClient();
    await supabase
      .from("insights")
      .update({ is_dismissed: true, is_read: true })
      .eq("id", insight.id);
  }

  async function handleRead() {
    if (insight.is_read) return;
    const supabase = createClient();
    await supabase.from("insights").update({ is_read: true }).eq("id", insight.id);
  }

  const timeAgo = formatDistanceToNow(parseISO(insight.created_at), {
    addSuffix: true,
  });

  return (
    <div
      onClick={handleRead}
      className={`relative bg-zinc-900 border border-zinc-800 border-l-2 ${BORDER_COLORS[insight.category]} rounded-xl p-5 group cursor-default`}
    >
      {/* Unread dot */}
      {!insight.is_read && (
        <span className="absolute top-4 right-10 w-1.5 h-1.5 rounded-full bg-emerald-400" />
      )}

      {/* Dismiss button */}
      <button
        onClick={(e) => {
          e.stopPropagation();
          handleDismiss();
        }}
        className="absolute top-3 right-3 w-6 h-6 rounded-md flex items-center justify-center text-zinc-600 hover:text-zinc-300 hover:bg-zinc-800 opacity-0 group-hover:opacity-100 transition-opacity"
        aria-label="Dismiss insight"
      >
        <X className="w-3.5 h-3.5" />
      </button>

      <div className="flex items-center gap-2 mb-2">
        <CategoryBadge category={insight.category} />
        <span className="text-xs text-zinc-500">{timeAgo}</span>
      </div>

      <p className="text-sm font-semibold text-zinc-50 mb-1 pr-6">{insight.title}</p>
      <p className="text-sm text-zinc-400 leading-relaxed">{insight.body}</p>
    </div>
  );
}
