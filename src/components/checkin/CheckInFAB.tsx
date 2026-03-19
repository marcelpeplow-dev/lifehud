"use client";

import { useState, useEffect } from "react";
import { SmilePlus, Check } from "lucide-react";
import { CheckInModal } from "./CheckInModal";
import type { CheckIn } from "@/types/index";

export function CheckInFAB() {
  // undefined = loading, null = no check-in today, CheckIn = done
  const [checkin, setCheckin] = useState<CheckIn | null | undefined>(undefined);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    fetch("/api/checkins")
      .then((r) => r.json())
      .then(({ checkin }) => setCheckin(checkin ?? null))
      .catch(() => setCheckin(null));
  }, []);

  // Don't render until we know the state — avoids flash
  if (checkin === undefined) return null;

  const done = checkin !== null;

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        aria-label="Daily check-in"
        className={`fixed bottom-20 right-4 md:bottom-6 md:right-6 z-40 w-14 h-14 rounded-full flex items-center justify-center shadow-xl transition-all active:scale-95 ${
          done
            ? "bg-zinc-800 border border-zinc-700 hover:bg-zinc-700"
            : "bg-emerald-500 hover:bg-emerald-400"
        }`}
      >
        {/* Pulsing ring when not checked in */}
        {!done && (
          <span className="absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-25 animate-ping" />
        )}
        {done ? (
          <Check className="w-5 h-5 text-emerald-400" />
        ) : (
          <SmilePlus className="w-6 h-6 text-zinc-950" />
        )}
      </button>

      {open && (
        <CheckInModal
          initialData={checkin}
          onClose={() => setOpen(false)}
          onSaved={(updated) => setCheckin(updated)}
        />
      )}
    </>
  );
}
