"use client";

import { useState, useEffect } from "react";
import { ClipboardList, Check } from "lucide-react";
import Link from "next/link";

export function CheckInFAB() {
  const [done, setDone] = useState<boolean | null>(null);

  useEffect(() => {
    // Check if there are any manual entries or a checkin for today
    Promise.all([
      fetch("/api/manual-entries?date=today").then((r) => r.json()).catch(() => ({ entries: [] })),
      fetch("/api/checkins").then((r) => r.json()).catch(() => ({ checkin: null })),
    ]).then(([manual, checkin]) => {
      const hasManual = (manual.entries?.length ?? 0) > 0;
      const hasCheckin = checkin.checkin != null;
      setDone(hasManual || hasCheckin);
    });
  }, []);

  // Don't render until we know the state
  if (done === null) return null;

  return (
    <Link
      href="/dashboard/daily-input"
      aria-label="Daily input"
      className={`fixed bottom-20 right-4 md:bottom-6 md:right-6 z-40 w-14 h-14 rounded-full flex items-center justify-center shadow-xl transition-all active:scale-95 ${
        done
          ? "bg-zinc-800 border border-zinc-700 hover:bg-zinc-700"
          : "bg-emerald-500 hover:bg-emerald-400"
      }`}
    >
      {!done && (
        <span className="absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-25 animate-ping" />
      )}
      {done ? (
        <Check className="w-5 h-5 text-emerald-400" />
      ) : (
        <ClipboardList className="w-6 h-6 text-zinc-950" />
      )}
    </Link>
  );
}
