"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Sparkles } from "lucide-react";
import { PackRevealModal } from "./PackRevealModal";
import { createClient } from "@/lib/supabase/client";
import type { Insight } from "@/types/index";

const COOLDOWN_MS = 24 * 60 * 60 * 1000;

function formatCountdown(ms: number): string {
  const h = Math.floor(ms / 3600000);
  const m = Math.floor((ms % 3600000) / 60000);
  const s = Math.floor((ms % 60000) / 1000);
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

export function GenerateButton() {
  const router = useRouter();
  const [state, setState] = useState<"idle" | "loading" | "done" | "error">("idle");
  const [message, setMessage] = useState<string | null>(null);
  const [packInsights, setPackInsights] = useState<Insight[] | null>(null);
  const [hasUnread, setHasUnread] = useState(false);
  const [cooldownEnd, setCooldownEnd] = useState<number | null>(null);
  const [countdown, setCountdown] = useState<string | null>(null);

  useEffect(() => {
    async function checkState() {
      const supabase = createClient();
      const [unreadRes, latestRes] = await Promise.all([
        supabase
          .from("insights")
          .select("*", { count: "exact", head: true })
          .eq("is_dismissed", false)
          .eq("is_read", false),
        supabase
          .from("insights")
          .select("created_at")
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle(),
      ]);
      setHasUnread((unreadRes.count ?? 0) > 0);
      if (latestRes.data?.created_at) {
        const end = new Date(latestRes.data.created_at).getTime() + COOLDOWN_MS;
        if (end > Date.now()) setCooldownEnd(end);
      }
    }
    checkState();
  }, []);

  // Tick countdown every second
  useEffect(() => {
    if (!cooldownEnd) return;
    function tick() {
      const remaining = cooldownEnd! - Date.now();
      if (remaining <= 0) {
        setCooldownEnd(null);
        setCountdown(null);
        return;
      }
      setCountdown(formatCountdown(remaining));
    }
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [cooldownEnd]);

  async function generate() {
    setState("loading");
    setMessage(null);
    try {
      const res = await fetch("/api/insights/generate", { method: "POST" });
      const data = await res.json();
      if (!res.ok) {
        setState("error");
        setMessage(data.error ?? "Failed to generate insights.");
        return;
      }
      if (data.generated === 0) {
        setState("done");
        setMessage(data.message ?? "Nothing new to generate.");
      } else {
        setState("done");
        setPackInsights(data.insights as Insight[]);
        // Start cooldown after successful generation
        setCooldownEnd(Date.now() + COOLDOWN_MS);
      }
    } catch {
      setState("error");
      setMessage("Network error.");
    }
  }

  function handleModalClose() {
    setPackInsights(null);
    setHasUnread(false);
    router.refresh();
  }

  const onCooldown = !!cooldownEnd && !hasUnread;
  const isDisabled = state === "loading" || hasUnread || onCooldown;

  return (
    <>
      <div className="flex flex-col items-end gap-1.5">
        <div className="flex items-center gap-3">
          {message && (
            <p className={`text-xs ${state === "error" ? "text-red-400" : "text-zinc-400"}`}>
              {message}
            </p>
          )}
          <button
            onClick={generate}
            disabled={isDisabled}
            title={hasUnread ? "Open your existing pack first" : onCooldown ? "Pack generation is on cooldown" : undefined}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-blue-500 hover:bg-blue-400 text-zinc-950 text-sm font-semibold transition-colors disabled:opacity-50"
          >
            <Sparkles className="w-4 h-4" />
            {state === "loading" ? "Generating…" : hasUnread ? "Open pack" : "Generate new pack"}
          </button>
        </div>
        {onCooldown && countdown && (
          <p className="text-xs text-zinc-400 font-mono">Next pack in {countdown}</p>
        )}
      </div>

      {packInsights && (
        <PackRevealModal insights={packInsights} onClose={handleModalClose} />
      )}
    </>
  );
}
