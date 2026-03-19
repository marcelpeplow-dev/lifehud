"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Sparkles } from "lucide-react";
import { PackRevealModal } from "./PackRevealModal";
import type { Insight } from "@/types/index";

export function GenerateButton() {
  const router = useRouter();
  const [state, setState] = useState<"idle" | "loading" | "done" | "error">("idle");
  const [message, setMessage] = useState<string | null>(null);
  const [packInsights, setPackInsights] = useState<Insight[] | null>(null);

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
      }
    } catch {
      setState("error");
      setMessage("Network error.");
    }
  }

  function handleModalClose() {
    setPackInsights(null);
    router.refresh();
  }

  return (
    <>
      <div className="flex items-center gap-3">
        {message && (
          <p className={`text-xs ${state === "error" ? "text-red-400" : "text-zinc-400"}`}>
            {message}
          </p>
        )}
        <button
          onClick={generate}
          disabled={state === "loading"}
          className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-zinc-950 text-sm font-semibold transition-colors disabled:opacity-50"
        >
          <Sparkles className="w-4 h-4" />
          {state === "loading" ? "Generating…" : "Generate insights"}
        </button>
      </div>

      {packInsights && (
        <PackRevealModal insights={packInsights} onClose={handleModalClose} />
      )}
    </>
  );
}
