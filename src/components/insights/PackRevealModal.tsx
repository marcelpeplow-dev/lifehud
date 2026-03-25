"use client";

import { useState, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Volume2, VolumeX, Share2, Download } from "lucide-react";
import { RarityBadge, DomainIcon } from "@/components/ui/Badge";
import { LegendaryMotif } from "@/components/ui/LegendaryMotif";
import { useRevealSound } from "./useRevealSound";
import type { Insight, InsightCategory, InsightRarity } from "@/types/index";

// ── Rarity accent colours (for particles + share image) ─────────────────────
const RARITY_ACCENT: Record<InsightRarity, string> = {
  common:    "#71717a",
  uncommon:  "#86efac",
  rare:      "#93c5fd",
  epic:      "#c4b5fd",
  legendary: "#fde68a",
};

const RARITY_CARD_CLASS: Record<InsightRarity, string> = {
  common:    "rarity-common",
  uncommon:  "rarity-uncommon",
  rare:      "rarity-rare",
  epic:      "rarity-epic",
  legendary: "rarity-legendary",
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
          className={`absolute inset-0 rounded-xl ${RARITY_CARD_CLASS[rarity]} bg-zinc-900 p-4 flex flex-col`}
          style={{ backfaceVisibility: "hidden", transform: "rotateY(180deg)" }}
        >
          <ParticleBurst color={accentColor} active={isRevealed && isEpicOrLegendary} />

          <div className="flex items-center gap-1.5 mb-2">
            <RarityBadge rarity={rarity} />
            <DomainIcon category={insight.category as InsightCategory} legendary={rarity === "legendary"} />
          </div>

          <p className="text-sm font-semibold text-zinc-50 mb-2 leading-snug line-clamp-2">
            {insight.title}
          </p>

          <p className="text-xs text-zinc-300 leading-relaxed flex-1 overflow-hidden line-clamp-5">
            {insight.body}
          </p>

          {rarity === "legendary" && (
            <LegendaryMotif category={insight.category as InsightCategory} />
          )}
        </div>
      </motion.div>
    </motion.div>
  );
}

// ── Share image helpers ───────────────────────────────────────────────────────

const RARITY_ORDER: InsightRarity[] = ["legendary", "epic", "rare", "uncommon", "common"];

function wrapText(ctx: CanvasRenderingContext2D, text: string, maxWidth: number, lineHeight: number, maxLines: number): string[] {
  const words = text.split(" ");
  const lines: string[] = [];
  let current = "";
  for (const word of words) {
    const test = current ? `${current} ${word}` : word;
    if (ctx.measureText(test).width > maxWidth && current) {
      lines.push(current);
      current = word;
      if (lines.length >= maxLines) break;
    } else {
      current = test;
    }
  }
  if (current && lines.length < maxLines) lines.push(current);
  return lines;
}

// Story format (9:16) — vertical list with rarity badge left, title right
async function generateStoryImage(insights: Insight[]): Promise<string> {
  const W = 380;
  const H = Math.round(W * (16 / 9)); // 675
  const pad = 24;
  const rowH = 52;
  const rowGap = 8;

  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const c = canvas.getContext("2d")!;

  // Background
  c.fillStyle = "#09090B";
  c.fillRect(0, 0, W, H);

  // Header
  c.fillStyle = "#10b981";
  c.font = "bold 16px system-ui, sans-serif";
  c.fillText("Life HUD", pad, 40);

  c.fillStyle = "#a1a1aa";
  c.font = "13px system-ui, sans-serif";
  c.fillText("Your weekly health insights", pad, 62);

  // Hero: best rarity count
  const counts = { legendary: 0, epic: 0, rare: 0, uncommon: 0, common: 0 } as Record<InsightRarity, number>;
  insights.forEach((i) => { counts[i.rarity ?? "common"]++; });
  const bestRarity = RARITY_ORDER.find((r) => counts[r] > 0) ?? "common";
  const bestCount = counts[bestRarity];

  c.fillStyle = RARITY_ACCENT[bestRarity];
  c.font = "bold 28px system-ui, sans-serif";
  const heroText = `${bestCount} ${bestRarity.charAt(0).toUpperCase() + bestRarity.slice(1)} insight${bestCount !== 1 ? "s" : ""}`;
  c.fillText(heroText, pad, 110);

  // Insight rows
  const startY = 140;
  const sorted = [...insights].sort((a, b) => {
    const ai = RARITY_ORDER.indexOf(a.rarity ?? "common");
    const bi = RARITY_ORDER.indexOf(b.rarity ?? "common");
    return ai - bi;
  });

  sorted.forEach((insight, idx) => {
    const rarity = insight.rarity ?? "common";
    const y = startY + idx * (rowH + rowGap);
    if (y + rowH > H - 60) return; // don't overflow

    // Row background
    c.beginPath();
    c.roundRect(pad, y, W - pad * 2, rowH, 8);
    c.fillStyle = "#18181B";
    c.fill();

    // Rarity badge
    c.fillStyle = RARITY_ACCENT[rarity];
    c.font = "bold 9px system-ui, sans-serif";
    const badgeText = rarity.toUpperCase();
    const badgeW = c.measureText(badgeText).width + 12;
    c.beginPath();
    c.roundRect(pad + 10, y + 10, badgeW, 16, 4);
    c.fillStyle = rarity === "legendary" ? "rgba(202,138,4,0.2)" : rarity === "epic" ? "rgba(139,92,246,0.2)" : rarity === "rare" ? "rgba(59,130,246,0.2)" : rarity === "uncommon" ? "rgba(34,197,94,0.2)" : "rgba(113,113,122,0.2)";
    c.fill();
    c.fillStyle = RARITY_ACCENT[rarity];
    c.font = "bold 9px system-ui, sans-serif";
    c.fillText(badgeText, pad + 16, y + 22);

    // Title (right of badge)
    c.fillStyle = "#fafafa";
    c.font = "12px system-ui, sans-serif";
    const titleX = pad + 16 + badgeW + 8;
    const maxTitleW = W - pad * 2 - titleX + pad - 10;
    const lines = wrapText(c, insight.title, maxTitleW, 14, 2);
    lines.forEach((line, li) => {
      c.fillText(line, titleX, y + 18 + li * 14);
    });
  });

  // Footer
  c.fillStyle = "#52525b";
  c.font = "11px system-ui, sans-serif";
  c.fillText("AI-powered self-improvement", pad, H - 20);

  c.fillStyle = "#10b981";
  c.font = "11px system-ui, sans-serif";
  c.textAlign = "right";
  c.fillText("lifehud.vercel.app", W - pad, H - 20);
  c.textAlign = "left";

  return canvas.toDataURL("image/png");
}

// Hero Pull format (landscape, best insight large + rest small)
async function generateHeroImage(insights: Insight[]): Promise<string> {
  const W = 900;
  const H = 500;
  const pad = 40;

  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const c = canvas.getContext("2d")!;

  c.fillStyle = "#09090B";
  c.fillRect(0, 0, W, H);

  // Header
  c.fillStyle = "#10b981";
  c.font = "bold 18px system-ui, sans-serif";
  c.fillText("Life HUD", pad, 38);

  const dateStr = new Date().toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
  c.fillStyle = "#71717a";
  c.font = "13px system-ui, sans-serif";
  c.textAlign = "right";
  c.fillText(dateStr, W - pad, 38);
  c.textAlign = "left";

  // Sort by rarity
  const sorted = [...insights].sort((a, b) => {
    return RARITY_ORDER.indexOf(a.rarity ?? "common") - RARITY_ORDER.indexOf(b.rarity ?? "common");
  });

  const hero = sorted[0];
  const rest = sorted.slice(1);
  const heroRarity = hero.rarity ?? "common";

  // Hero card (large, centered top)
  const heroW = W - pad * 2;
  const heroH = 160;
  const heroY = 70;
  c.beginPath();
  c.roundRect(pad, heroY, heroW, heroH, 12);
  c.fillStyle = "#18181B";
  c.fill();
  c.strokeStyle = RARITY_ACCENT[heroRarity];
  c.lineWidth = 2;
  c.stroke();

  c.fillStyle = RARITY_ACCENT[heroRarity];
  c.font = "bold 12px system-ui, sans-serif";
  c.fillText(heroRarity.toUpperCase(), pad + 16, heroY + 28);

  c.fillStyle = "#fafafa";
  c.font = "bold 18px system-ui, sans-serif";
  const heroLines = wrapText(c, hero.title, heroW - 40, 24, 2);
  heroLines.forEach((line, i) => {
    c.fillText(line, pad + 16, heroY + 58 + i * 24);
  });

  c.fillStyle = "#a1a1aa";
  c.font = "13px system-ui, sans-serif";
  const bodyLines = wrapText(c, hero.body, heroW - 40, 18, 3);
  bodyLines.forEach((line, i) => {
    c.fillText(line, pad + 16, heroY + 100 + i * 18);
  });

  // Rest cards (small row below)
  const restY = heroY + heroH + 20;
  const restCardW = rest.length > 0 ? (heroW - (rest.length - 1) * 12) / rest.length : heroW;

  rest.forEach((insight, idx) => {
    const rarity = insight.rarity ?? "common";
    const x = pad + idx * (restCardW + 12);

    c.beginPath();
    c.roundRect(x, restY, restCardW, 100, 8);
    c.fillStyle = "#18181B";
    c.fill();
    c.strokeStyle = RARITY_ACCENT[rarity];
    c.lineWidth = 1;
    c.stroke();

    c.fillStyle = RARITY_ACCENT[rarity];
    c.font = "bold 9px system-ui, sans-serif";
    c.fillText(rarity.toUpperCase(), x + 10, restY + 18);

    c.fillStyle = "#fafafa";
    c.font = "11px system-ui, sans-serif";
    const lines = wrapText(c, insight.title, restCardW - 20, 14, 4);
    lines.forEach((line, i) => {
      c.fillText(line, x + 10, restY + 36 + i * 14);
    });
  });

  // Footer
  c.fillStyle = "#52525b";
  c.font = "11px system-ui, sans-serif";
  c.fillText("AI-powered self-improvement", pad, H - 20);
  c.fillStyle = "#10b981";
  c.textAlign = "right";
  c.fillText("lifehud.vercel.app", W - pad, H - 20);
  c.textAlign = "left";

  return canvas.toDataURL("image/png");
}

// Generate both formats; return story for mobile share, hero for twitter
async function generateShareImage(insights: Insight[]): Promise<{ story: string; hero: string }> {
  const [story, hero] = await Promise.all([
    generateStoryImage(insights),
    generateHeroImage(insights),
  ]);
  return { story, hero };
}

// ── Main modal ────────────────────────────────────────────────────────────────
interface PackRevealModalProps {
  insights: Insight[];
  onClose: () => void;
}

export function PackRevealModal({ insights, onClose }: PackRevealModalProps) {
  const [revealed, setRevealed] = useState<Set<string>>(new Set());
  const [muted, setMuted] = useState(false);
  const [shareImages, setShareImages] = useState<{ story: string; hero: string } | null>(null);
  const [isGeneratingImage, setIsGeneratingImage] = useState(false);
  const { playRarity } = useRevealSound(muted);
  const containerRef = useRef<HTMLDivElement>(null);

  const allRevealed = revealed.size === insights.length;

  const handleReveal = useCallback(
    async (insight: Insight) => {
      setRevealed((prev) => new Set([...prev, insight.id]));
      playRarity(insight.rarity ?? "common");
      // Mark as read in database
      const { createClient } = await import("@/lib/supabase/client");
      const supabase = createClient();
      await supabase.from("insights").update({ is_read: true }).eq("id", insight.id);
    },
    [playRarity]
  );

  async function handleShare() {
    setIsGeneratingImage(true);
    const images = await generateShareImage(insights);
    setShareImages(images);
    setIsGeneratingImage(false);

    const rarityStr = (["legendary", "epic", "rare"] as InsightRarity[])
      .filter((r) => insights.some((i) => (i.rarity ?? "common") === r))
      .map((r) => r)
      .join(", ");

    const tweetText = `Just opened my weekly insight pack from Life HUD\n${rarityStr ? `Got a ${rarityStr} insight! ` : ""}lifehud.vercel.app`;

    // Mobile: use story format via Web Share API
    if (navigator.share) {
      try {
        const blob = await fetch(images.story).then((r) => r.blob());
        const file = new File([blob], "lifehud-insights.png", { type: "image/png" });
        await navigator.share({ title: "My Life HUD Insights", text: tweetText, files: [file] });
        return;
      } catch {
        // Fall through to Twitter with hero format
      }
    }

    // Desktop: use hero format for Twitter intent
    window.open(
      `https://twitter.com/intent/tweet?text=${encodeURIComponent(tweetText)}`,
      "_blank"
    );
  }

  function handleDownload() {
    if (!shareImages) return;
    const a = document.createElement("a");
    a.href = shareImages.story;
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
              {shareImages ? (
                <div className="space-y-3">
                  <img
                    src={shareImages.story}
                    alt="Share preview"
                    className="rounded-xl w-full max-w-sm mx-auto border border-zinc-800"
                  />
                  <div className="flex gap-2">
                    <button
                      onClick={handleShare}
                      className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-blue-500 hover:bg-blue-400 text-zinc-950 text-sm font-semibold transition-colors"
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
