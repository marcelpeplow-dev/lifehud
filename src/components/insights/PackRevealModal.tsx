"use client";

import { useState, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Volume2, VolumeX, Share2, Download } from "lucide-react";
import { RarityBadge } from "@/components/ui/Badge";
import { useRevealSound } from "./useRevealSound";
import type { Insight, InsightRarity } from "@/types/index";

// ── Rarity accent colours (for particles + share image) ─────────────────────
const RARITY_ACCENT: Record<InsightRarity, string> = {
  common:    "#71717a",
  uncommon:  "#86efac",
  rare:      "#93c5fd",
  epic:      "#c4b5fd",
  legendary: "#fde68a",
};

const RARITY_CARD_BG: Record<InsightRarity, string> = {
  common:    "border-zinc-600 bg-zinc-800/60",
  uncommon:  "border-green-700 bg-green-950/40",
  rare:      "border-blue-700 bg-blue-950/40",
  epic:      "border-violet-600 bg-violet-950/40",
  legendary: "border-amber-500 bg-amber-950/40",
};

// ── Particle burst component ──────────────────────────────────────────────────
const PARTICLE_COUNT = 14;
function ParticleBurst({ color, active }: { color: string; active: boolean }) {
  if (!active) return null;
  return (
    <div className="absolute inset-0 pointer-events-none" style={{ zIndex: 10 }}>
      {Array.from({ length: PARTICLE_COUNT }).map((_, i) => {
        const angle = (2 * Math.PI * i) / PARTICLE_COUNT;
        return (
          <motion.div
            key={i}
            className="absolute rounded-full"
            style={{
              width: i % 3 === 0 ? 8 : 5,
              height: i % 3 === 0 ? 8 : 5,
              background: color,
              left: "50%",
              top: "50%",
              marginLeft: "-4px",
              marginTop: "-4px",
            }}
            initial={{ x: 0, y: 0, opacity: 1, scale: 1 }}
            animate={{
              x: Math.cos(angle) * (60 + (i % 3) * 20),
              y: Math.sin(angle) * (60 + (i % 3) * 20),
              opacity: 0,
              scale: 0,
            }}
            transition={{ duration: 0.55, ease: "easeOut" }}
          />
        );
      })}
    </div>
  );
}

// ── Single flip card ──────────────────────────────────────────────────────────
interface FlipCardProps {
  insight: Insight;
  index: number;
  isRevealed: boolean;
  onReveal: () => void;
}

function FlipCard({ insight, index, isRevealed, onReveal }: FlipCardProps) {
  const rarity: InsightRarity = insight.rarity ?? "common";
  const accentColor = RARITY_ACCENT[rarity];
  const isEpicOrLegendary = rarity === "epic" || rarity === "legendary";
  const [shaking, setShaking] = useState(false);

  function handleReveal() {
    if (isRevealed) return;
    onReveal();
    if (rarity === "legendary") {
      setTimeout(() => setShaking(true), 350);
      setTimeout(() => setShaking(false), 900);
    }
  }

  return (
    <motion.div
      className="relative"
      style={{ perspective: 1200 }}
      variants={{
        hidden: { y: 50, opacity: 0 },
        show:   { y: 0,  opacity: 1, transition: { duration: 0.4, ease: "easeOut", delay: index * 0.15 } },
      }}
    >
      <motion.div
        className={shaking ? "legendary-shake" : ""}
        style={{ transformStyle: "preserve-3d", position: "relative", height: 260 }}
        animate={{ rotateY: isRevealed ? 180 : 0 }}
        transition={{ duration: 0.6, ease: [0.4, 0, 0.2, 1] }}
        onClick={handleReveal}
      >
        {/* Card back */}
        <div
          className="absolute inset-0 rounded-xl border border-zinc-700 bg-zinc-800 flex flex-col items-center justify-center gap-3 cursor-pointer select-none"
          style={{ backfaceVisibility: "hidden" }}
        >
          <div className="w-12 h-12 rounded-full bg-zinc-700 flex items-center justify-center">
            <span className="text-2xl font-bold text-zinc-400">?</span>
          </div>
          <span className="text-xs font-semibold tracking-widest text-zinc-500 uppercase">
            Insight
          </span>
          <span className="text-xs text-zinc-600">Click to reveal</span>
        </div>

        {/* Card front */}
        <div
          className={`absolute inset-0 rounded-xl border-2 ${RARITY_CARD_BG[rarity]} p-4 flex flex-col overflow-hidden`}
          style={{ backfaceVisibility: "hidden", transform: "rotateY(180deg)" }}
        >
          <ParticleBurst color={accentColor} active={isRevealed && isEpicOrLegendary} />

          <div className="flex items-start justify-between mb-2">
            <RarityBadge rarity={rarity} />
          </div>

          <p className="text-sm font-semibold text-zinc-50 mb-2 leading-snug line-clamp-2">
            {insight.title}
          </p>

          <p className="text-xs text-zinc-300 leading-relaxed flex-1 overflow-hidden line-clamp-5">
            {insight.body}
          </p>

          {rarity === "legendary" && (
            <div className="mt-2 pt-2 border-t border-amber-800/40">
              <span className="text-xs text-amber-300/70 font-medium">✦ Legendary find</span>
            </div>
          )}
        </div>
      </motion.div>
    </motion.div>
  );
}

// ── Share image via Canvas API ────────────────────────────────────────────────
async function generateShareImage(insights: Insight[]): Promise<string> {
  const W = 900;
  const cardW = 200;
  const cardH = 220;
  const gap = 16;
  const paddingX = 40;
  const topPad = 80;
  const bottomPad = 80;
  const H = topPad + cardH + bottomPad;

  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const c = canvas.getContext("2d")!;

  // Background
  c.fillStyle = "#09090b";
  c.fillRect(0, 0, W, H);

  // Logo
  c.fillStyle = "#10b981";
  c.font = "bold 18px system-ui, sans-serif";
  c.fillText("Life HUD", paddingX, 38);

  // Date
  const dateStr = new Date().toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
  c.fillStyle = "#71717a";
  c.font = "13px system-ui, sans-serif";
  c.textAlign = "right";
  c.fillText(dateStr, W - paddingX, 38);
  c.textAlign = "left";

  // Rarity counts
  const counts = { legendary: 0, epic: 0, rare: 0, uncommon: 0, common: 0 } as Record<InsightRarity, number>;
  insights.forEach((i) => { const r = i.rarity ?? "common"; counts[r]++; });
  const summaryParts = (["legendary", "epic", "rare", "uncommon", "common"] as InsightRarity[])
    .filter((r) => counts[r] > 0)
    .map((r) => `${counts[r]} ${r}`);
  c.fillStyle = "#a1a1aa";
  c.font = "12px system-ui, sans-serif";
  c.fillText(summaryParts.join(" · "), paddingX, H - 28);

  // CTA
  const cta = "What's hiding in your data? → lifehud.vercel.app";
  c.fillStyle = "#52525b";
  c.font = "12px system-ui, sans-serif";
  c.textAlign = "right";
  c.fillText(cta, W - paddingX, H - 28);
  c.textAlign = "left";

  // Cards
  const totalW = insights.length * cardW + (insights.length - 1) * gap;
  const startX = (W - totalW) / 2;

  insights.forEach((insight, idx) => {
    const rarity: InsightRarity = insight.rarity ?? "common";
    const x = startX + idx * (cardW + gap);
    const y = topPad;

    // Card background
    const bgColor = {
      common: "#27272a", uncommon: "#052e16", rare: "#0c1a2e",
      epic: "#1a0d2e", legendary: "#1c0f00",
    }[rarity];
    const borderColor = RARITY_ACCENT[rarity];

    // Rounded rect
    c.beginPath();
    c.roundRect(x, y, cardW, cardH, 12);
    c.fillStyle = bgColor;
    c.fill();
    c.strokeStyle = borderColor;
    c.lineWidth = 2;
    c.stroke();

    // Rarity label
    c.fillStyle = RARITY_ACCENT[rarity];
    c.font = "bold 10px system-ui, sans-serif";
    c.fillText(rarity.toUpperCase(), x + 12, y + 22);

    // Title
    c.fillStyle = "#fafafa";
    c.font = "bold 11px system-ui, sans-serif";
    const words = insight.title.split(" ");
    let line = "";
    let lineY = y + 46;
    for (const word of words) {
      const test = line ? `${line} ${word}` : word;
      if (c.measureText(test).width > cardW - 24) {
        c.fillText(line, x + 12, lineY);
        line = word;
        lineY += 16;
        if (lineY > y + 80) break;
      } else {
        line = test;
      }
    }
    if (line) c.fillText(line, x + 12, lineY);
  });

  return canvas.toDataURL("image/png");
}

// ── Main modal ────────────────────────────────────────────────────────────────
interface PackRevealModalProps {
  insights: Insight[];
  onClose: () => void;
}

export function PackRevealModal({ insights, onClose }: PackRevealModalProps) {
  const [revealed, setRevealed] = useState<Set<string>>(new Set());
  const [muted, setMuted] = useState(false);
  const [shareImageUrl, setShareImageUrl] = useState<string | null>(null);
  const [isGeneratingImage, setIsGeneratingImage] = useState(false);
  const { playRarity } = useRevealSound(muted);
  const containerRef = useRef<HTMLDivElement>(null);

  const allRevealed = revealed.size === insights.length;

  const handleReveal = useCallback(
    (insight: Insight) => {
      setRevealed((prev) => new Set([...prev, insight.id]));
      playRarity(insight.rarity ?? "common");
    },
    [playRarity]
  );

  async function handleShare() {
    setIsGeneratingImage(true);
    const url = await generateShareImage(insights);
    setShareImageUrl(url);
    setIsGeneratingImage(false);

    const rarityStr = (["legendary", "epic", "rare"] as InsightRarity[])
      .filter((r) => insights.some((i) => (i.rarity ?? "common") === r))
      .map((r) => r)
      .join(", ");

    const tweetText = `Just opened my weekly insight pack from Life HUD 🃏${rarityStr ? ` Got a ${rarityStr} insight!` : ""} lifehud.vercel.app`;

    if (navigator.share) {
      try {
        const blob = await fetch(url).then((r) => r.blob());
        const file = new File([blob], "lifehud-insights.png", { type: "image/png" });
        await navigator.share({ title: "My Life HUD Insights", text: tweetText, files: [file] });
        return;
      } catch {
        // Fall through to Twitter
      }
    }

    window.open(
      `https://twitter.com/intent/tweet?text=${encodeURIComponent(tweetText)}`,
      "_blank"
    );
  }

  function handleDownload() {
    if (!shareImageUrl) return;
    const a = document.createElement("a");
    a.href = shareImageUrl;
    a.download = "lifehud-insights.png";
    a.click();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" ref={containerRef}>
      {/* Backdrop */}
      <motion.div
        className="absolute inset-0 bg-black/75 backdrop-blur-sm"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        onClick={onClose}
      />

      {/* Modal */}
      <motion.div
        className="relative bg-zinc-950 border border-zinc-800 rounded-2xl w-full max-w-4xl shadow-2xl overflow-hidden"
        initial={{ scale: 0.94, opacity: 0, y: 20 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        transition={{ duration: 0.3, ease: "easeOut" }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 pt-5 pb-4 border-b border-zinc-800">
          <div>
            <h2 className="text-lg font-semibold text-zinc-50">Your insight pack</h2>
            <p className="text-xs text-zinc-500 mt-0.5">
              {allRevealed
                ? "All insights revealed"
                : `${insights.length - revealed.size} card${insights.length - revealed.size !== 1 ? "s" : ""} remaining — click to reveal`}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setMuted((m) => !m)}
              className="p-2 rounded-lg text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800 transition-colors"
              aria-label={muted ? "Unmute" : "Mute"}
            >
              {muted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
            </button>
            <button
              onClick={onClose}
              className="p-2 rounded-lg text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Cards */}
        <div className="p-6 overflow-x-auto">
          <motion.div
            className="flex gap-4 min-w-max mx-auto justify-center"
            variants={{ hidden: {}, show: { transition: { staggerChildren: 0.15 } } }}
            initial="hidden"
            animate="show"
          >
            {insights.map((insight, i) => (
              <div key={insight.id} className="w-48 shrink-0">
                <FlipCard
                  insight={insight}
                  index={i}
                  isRevealed={revealed.has(insight.id)}
                  onReveal={() => handleReveal(insight)}
                />
              </div>
            ))}
          </motion.div>
        </div>

        {/* Share section */}
        <AnimatePresence>
          {allRevealed && (
            <motion.div
              className="px-6 pb-6"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.35, ease: "easeOut" }}
            >
              {shareImageUrl ? (
                <div className="space-y-3">
                  <img
                    src={shareImageUrl}
                    alt="Share preview"
                    className="rounded-xl w-full border border-zinc-800"
                  />
                  <div className="flex gap-2">
                    <button
                      onClick={handleShare}
                      className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-zinc-950 text-sm font-semibold transition-colors"
                    >
                      <Share2 className="w-3.5 h-3.5" />
                      Share
                    </button>
                    <button
                      onClick={handleDownload}
                      className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-50 text-sm font-medium transition-colors"
                    >
                      <Download className="w-3.5 h-3.5" />
                      Save image
                    </button>
                  </div>
                </div>
              ) : (
                <div className="flex items-center justify-between pt-2 border-t border-zinc-800">
                  <p className="text-sm text-zinc-400">All insights revealed!</p>
                  <button
                    onClick={handleShare}
                    disabled={isGeneratingImage}
                    className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-50 text-sm font-medium transition-colors disabled:opacity-50"
                  >
                    <Share2 className="w-3.5 h-3.5" />
                    {isGeneratingImage ? "Generating…" : "Share your pack"}
                  </button>
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </div>
  );
}
