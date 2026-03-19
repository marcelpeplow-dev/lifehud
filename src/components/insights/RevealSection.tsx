"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Sparkles } from "lucide-react";
import { PackRevealModal } from "./PackRevealModal";
import type { Insight } from "@/types/index";

export function RevealSection({ insights }: { insights: Insight[] }) {
  const [open, setOpen] = useState(false);
  const router = useRouter();

  function handleClose() {
    setOpen(false);
    router.refresh();
  }

  return (
    <>
      <div className="flex items-center gap-3 px-4 py-3 bg-emerald-500/10 border border-emerald-500/20 rounded-xl">
        <Sparkles className="w-4 h-4 text-emerald-400 shrink-0" />
        <p className="text-sm text-emerald-300 flex-1">
          You have <span className="font-semibold">{insights.length}</span> unread insight{insights.length !== 1 ? "s" : ""} waiting.
        </p>
        <button
          onClick={() => setOpen(true)}
          className="px-3 py-1.5 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-zinc-950 text-xs font-semibold transition-colors shrink-0"
        >
          Open pack
        </button>
      </div>

      {open && <PackRevealModal insights={insights} onClose={handleClose} />}
    </>
  );
}
