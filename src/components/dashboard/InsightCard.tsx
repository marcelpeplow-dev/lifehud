"use client";

import { useState } from "react";
import { X } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { formatDistanceToNow, parseISO } from "date-fns";
import { RarityBadge, MultiDomainIcons } from "@/components/ui/Badge";
import { LegendaryMotif } from "@/components/ui/LegendaryMotif";
import { createClient } from "@/lib/supabase/client";
import { detectDomains } from "@/lib/insights/domains";
import type { Insight, InsightCategory, InsightRarity } from "@/types/index";

const RARITY_CSS_CLASS: Record<InsightRarity, string> = {
  common:    "rarity-common",
  uncommon:  "rarity-uncommon",
  rare:      "rarity-rare",
  epic:      "rarity-epic",
  legendary: "rarity-legendary",
};

const CONFIDENCE_LABEL: Record<string, string> = {
  high:        "High confidence",
  medium:      "Medium confidence",
  speculative: "Speculative",
};

// ── Action button accent colors per rarity ───────────────────────────────────
const RARITY_BUTTON_STYLE: Record<InsightRarity, { bg: string; border: string; text: string }> = {
  common:    { bg: "rgba(113,113,122,0.08)", border: "rgba(113,113,122,0.2)", text: "text-zinc-400" },
  uncommon:  { bg: "rgba(34,197,94,0.08)", border: "rgba(34,197,94,0.2)", text: "text-green-400" },
  rare:      { bg: "rgba(59,130,246,0.08)", border: "rgba(59,130,246,0.2)", text: "text-blue-400" },
  epic:      { bg: "rgba(139,92,246,0.08)", border: "rgba(139,92,246,0.2)", text: "text-violet-400" },
  legendary: { bg: "rgba(202,138,4,0.08)", border: "rgba(202,138,4,0.2)", text: "text-amber-400" },
};

// ── Action button icon SVGs ──────────────────────────────────────────────────
function TrendIcon({ className }: { className?: string }) {
  return (
    <svg className={className} width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="1,12 4,8 7,10 10,4 15,6" />
    </svg>
  );
}

function ActionIcon({ className }: { className?: string }) {
  return (
    <svg className={className} width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="8" cy="8" r="6" />
      <polyline points="8,4 8,8 11,10" />
    </svg>
  );
}

function ConnectionsIcon({ className }: { className?: string }) {
  return (
    <svg className={className} width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="8" cy="8" r="2" />
      <line x1="8" y1="1" x2="8" y2="4" /><line x1="8" y1="12" x2="8" y2="15" />
      <line x1="1" y1="8" x2="4" y2="8" /><line x1="12" y1="8" x2="15" y2="8" />
      <line x1="3" y1="3" x2="5" y2="5" /><line x1="11" y1="11" x2="13" y2="13" />
      <line x1="13" y1="3" x2="11" y2="5" /><line x1="5" y1="11" x2="3" y2="13" />
    </svg>
  );
}

interface InsightCardProps {
  insight: Insight;
}

export function InsightCard({ insight }: InsightCardProps) {
  const [dismissed, setDismissed] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [askResponse, setAskResponse] = useState<string | null>(null);
  const [askLoading, setAskLoading] = useState(false);
  const rarity: InsightRarity = insight.rarity ?? "common";
  const category = insight.category as InsightCategory;
  const domains = detectDomains(category, insight.title, insight.body);
  const btnStyle = RARITY_BUTTON_STYLE[rarity];

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

  function handleToggle() {
    setExpanded((e) => !e);
    handleRead();
  }

  async function handleAsk(type: "trend" | "action" | "connections") {
    setAskLoading(true);
    setAskResponse(null);
    try {
      const res = await fetch(`/api/insights/${insight.id}/ask`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type }),
      });
      const data = await res.json();
      setAskResponse(data.response ?? data.error ?? "No response.");
    } catch {
      setAskResponse("Failed to get response.");
    } finally {
      setAskLoading(false);
    }
  }

  const timeAgo = formatDistanceToNow(parseISO(insight.created_at), { addSuffix: true });
  const confidence = (insight as unknown as Record<string, unknown>).confidence as string | undefined;

  return (
    <motion.div
      layout
      onClick={handleToggle}
      className={`relative bg-zinc-900 rounded-xl p-5 group cursor-pointer ${RARITY_CSS_CLASS[rarity]}`}
    >
      {/* Unread dot */}
      {!insight.is_read && (
        <span className="absolute top-4 right-10 w-1.5 h-1.5 rounded-full bg-blue-400" />
      )}

      {/* Dismiss button */}
      <button
        onClick={(e) => { e.stopPropagation(); handleDismiss(); }}
        className="absolute top-3 right-3 w-6 h-6 rounded-md flex items-center justify-center text-zinc-600 hover:text-zinc-300 hover:bg-zinc-800 opacity-0 group-hover:opacity-100 transition-opacity"
        aria-label="Dismiss insight"
      >
        <X className="w-3.5 h-3.5" />
      </button>

      {/* Header */}
      <div className="flex items-center gap-2 mb-2">
        <RarityBadge rarity={rarity} />
        <MultiDomainIcons domains={domains} legendary={rarity === "legendary"} />
        <span className="text-xs text-zinc-500">{timeAgo}</span>
      </div>

      {/* Title */}
      <p className="text-sm font-semibold text-zinc-50 mb-1 pr-6">{insight.title}</p>

      {/* Collapsed: one-line summary + hint */}
      {!expanded && (
        <p className="text-sm text-zinc-400 leading-relaxed line-clamp-1">{insight.body}</p>
      )}
      {!expanded && (
        <p className="text-xs text-zinc-600 mt-2">Tap to explore</p>
      )}

      {/* Expanded content */}
      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.25, ease: "easeOut" }}
            className="overflow-hidden"
          >
            <p className="text-sm text-zinc-400 leading-relaxed mb-3">{insight.body}</p>

            {/* Confidence badge */}
            {confidence && (
              <p className="text-xs text-zinc-500 mb-3">
                {CONFIDENCE_LABEL[confidence] ?? confidence}
              </p>
            )}

            {/* Action buttons */}
            <div
              className="grid grid-cols-3 gap-2 mb-2"
              onClick={(e) => e.stopPropagation()}
            >
              <ActionButton
                icon={<TrendIcon className="w-4 h-4" />}
                label="Trend"
                sub="How has this changed?"
                style={btnStyle}
                loading={askLoading}
                onClick={() => handleAsk("trend")}
              />
              <ActionButton
                icon={<ActionIcon className="w-4 h-4" />}
                label="Action"
                sub="What should I do?"
                style={btnStyle}
                loading={askLoading}
                onClick={() => handleAsk("action")}
              />
              <ActionButton
                icon={<ConnectionsIcon className="w-4 h-4" />}
                label="Connections"
                sub="What else does this affect?"
                style={btnStyle}
                loading={askLoading}
                onClick={() => handleAsk("connections")}
              />
            </div>

            {/* Ask response bubble */}
            {(askLoading || askResponse) && (
              <div className="mt-3 p-3 bg-zinc-800/60 rounded-lg border border-zinc-700/50">
                {askLoading ? (
                  <p className="text-xs text-zinc-500 animate-pulse">Thinking...</p>
                ) : (
                  <p className="text-sm text-zinc-300 leading-relaxed">{askResponse}</p>
                )}
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {rarity === "legendary" && (
        <LegendaryMotif category={category} />
      )}
    </motion.div>
  );
}

// ── Action button sub-component ──────────────────────────────────────────────
function ActionButton({
  icon,
  label,
  sub,
  style,
  loading,
  onClick,
}: {
  icon: React.ReactNode;
  label: string;
  sub: string;
  style: { bg: string; border: string; text: string };
  loading: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      disabled={loading}
      className={`flex flex-col items-center gap-1 py-2 px-1 rounded-lg transition-colors disabled:opacity-50 ${style.text}`}
      style={{ background: style.bg, border: `1px solid ${style.border}` }}
    >
      <span className="w-7 h-7 rounded-md flex items-center justify-center" style={{ background: style.bg }}>
        {icon}
      </span>
      <span className="text-xs font-medium">{label}</span>
      <span className="text-[10px] text-zinc-500 leading-tight text-center">{sub}</span>
    </button>
  );
}
