"use client";

import { useState } from "react";
import { X, CheckCircle } from "lucide-react";
import type { CheckIn } from "@/types/index";

// ─── SLIDER ───────────────────────────────────────────────────────────────────

function Slider({
  label,
  value,
  onChange,
  lowEmoji,
  highEmoji,
  lowLabel,
  highLabel,
  color,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  lowEmoji: string;
  highEmoji: string;
  lowLabel: string;
  highLabel: string;
  color: string;
}) {
  const pct = ((value - 1) / 9) * 100;
  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <span className="text-sm font-medium text-zinc-200">{label}</span>
        <span className="text-xl font-bold tabular-nums" style={{ color }}>
          {value}
          <span className="text-xs font-normal text-zinc-500">/10</span>
        </span>
      </div>
      <input
        type="range"
        min={1}
        max={10}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        style={{
          background: `linear-gradient(to right, ${color} 0%, ${color} ${pct}%, #3f3f46 ${pct}%, #3f3f46 100%)`,
          accentColor: color,
        }}
        className="w-full h-2 rounded-full appearance-none cursor-pointer
          [&::-webkit-slider-thumb]:appearance-none
          [&::-webkit-slider-thumb]:w-5
          [&::-webkit-slider-thumb]:h-5
          [&::-webkit-slider-thumb]:rounded-full
          [&::-webkit-slider-thumb]:bg-zinc-50
          [&::-webkit-slider-thumb]:shadow-md
          [&::-webkit-slider-thumb]:cursor-pointer
          [&::-moz-range-thumb]:w-5
          [&::-moz-range-thumb]:h-5
          [&::-moz-range-thumb]:rounded-full
          [&::-moz-range-thumb]:bg-zinc-50
          [&::-moz-range-thumb]:border-0
          [&::-moz-range-thumb]:cursor-pointer"
      />
      <div className="flex justify-between mt-1.5">
        <span className="text-xs text-zinc-600">{lowEmoji} {lowLabel}</span>
        <span className="text-xs text-zinc-600">{highEmoji} {highLabel}</span>
      </div>
    </div>
  );
}

// ─── MODAL ────────────────────────────────────────────────────────────────────

interface CheckInModalProps {
  initialData: CheckIn | null;
  onClose: () => void;
  onSaved: (checkin: CheckIn) => void;
}

export function CheckInModal({ initialData, onClose, onSaved }: CheckInModalProps) {
  const [mood, setMood] = useState(initialData?.mood ?? 7);
  const [energy, setEnergy] = useState(initialData?.energy ?? 7);
  const [stress, setStress] = useState(initialData?.stress ?? 3);
  const [notes, setNotes] = useState(initialData?.notes ?? "");
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    const res = await fetch("/api/checkins", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ mood, energy, stress, notes: notes.trim() || null }),
    });
    if (res.ok) {
      const { checkin } = await res.json();
      setDone(true);
      setTimeout(() => { onSaved(checkin); onClose(); }, 1000);
    } else {
      setSubmitting(false);
    }
  }

  const overlay = "fixed inset-0 bg-zinc-950/80 backdrop-blur-sm z-50 flex items-end sm:items-center justify-center";
  const panel = "w-full sm:max-w-md bg-zinc-900 border border-zinc-800 rounded-t-2xl sm:rounded-2xl";

  if (done) {
    return (
      <div className={overlay}>
        <div className={`${panel} p-12 flex flex-col items-center gap-4`}>
          <div className="w-16 h-16 rounded-full bg-emerald-500/10 flex items-center justify-center">
            <CheckCircle className="w-8 h-8 text-emerald-400" />
          </div>
          <p className="text-base font-semibold text-zinc-50">
            {initialData ? "Updated!" : "Logged!"}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className={overlay} onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className={panel}>
        {/* Handle bar (mobile) */}
        <div className="flex justify-center pt-3 pb-1 sm:hidden">
          <div className="w-10 h-1 rounded-full bg-zinc-700" />
        </div>

        {/* Header */}
        <div className="flex items-start justify-between px-6 pt-4 sm:pt-6 pb-2">
          <div>
            <h2 className="text-base font-semibold text-zinc-50">How are you feeling today?</h2>
            <p className="text-xs text-zinc-500 mt-0.5">Quick check-in — under 15 seconds</p>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-lg text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800 transition-colors shrink-0 ml-4"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="px-6 pb-6 pt-3 space-y-5">
          <Slider
            label="Mood"
            value={mood} onChange={setMood}
            lowEmoji="😞" lowLabel="awful"
            highEmoji="😄" highLabel="great"
            color="#10b981"
          />
          <Slider
            label="Energy"
            value={energy} onChange={setEnergy}
            lowEmoji="😴" lowLabel="exhausted"
            highEmoji="⚡" highLabel="wired"
            color="#f59e0b"
          />
          <Slider
            label="Stress"
            value={stress} onChange={setStress}
            lowEmoji="😌" lowLabel="calm"
            highEmoji="😤" highLabel="overwhelmed"
            color="#ef4444"
          />

          <div>
            <label className="block text-sm font-medium text-zinc-300 mb-1.5">
              Notes <span className="text-zinc-600 font-normal">(optional)</span>
            </label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Anything on your mind?"
              maxLength={500}
              rows={2}
              className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2.5 text-sm text-zinc-50 placeholder-zinc-600 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition resize-none"
            />
            {notes.length > 400 && (
              <p className="text-xs text-zinc-600 text-right mt-1">{notes.length}/500</p>
            )}
          </div>

          <button
            type="submit"
            disabled={submitting}
            className="w-full bg-emerald-500 hover:bg-emerald-400 disabled:opacity-50 disabled:cursor-not-allowed text-zinc-950 font-semibold rounded-xl py-3 text-sm transition-colors"
          >
            {submitting ? "Saving…" : initialData ? "Update check-in" : "Log check-in"}
          </button>
        </form>
      </div>
    </div>
  );
}
