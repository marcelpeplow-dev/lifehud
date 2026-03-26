"use client";

import { useState } from "react";
import { Heart, ChevronDown } from "lucide-react";

const CORE_SLIDERS: { id: string; label: string }[] = [
  { id: "wellbeing_mood",   label: "Mood" },
  { id: "wellbeing_energy", label: "Energy" },
  { id: "wellbeing_stress", label: "Stress" },
];

interface Props {
  values: Record<string, number>;
  onChange: (metricId: string, value: number) => void;
  showFocus: boolean;
  showJournal: boolean;
  journal: string;
  onJournalChange: (text: string) => void;
}

export function WellbeingSliders({
  values, onChange, showFocus, showJournal, journal, onJournalChange,
}: Props) {
  const [journalOpen, setJournalOpen] = useState(journal.length > 0);

  const sliders = showFocus
    ? [...CORE_SLIDERS, { id: "wellbeing_focus", label: "Focus" }]
    : CORE_SLIDERS;

  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4 space-y-4">
      {/* Section header */}
      <div className="flex items-center gap-2">
        <div className="w-7 h-7 rounded-lg bg-rose-500/10 flex items-center justify-center">
          <Heart className="w-3.5 h-3.5 text-rose-400" />
        </div>
        <span className="text-sm font-semibold text-zinc-100">Wellbeing</span>
      </div>

      {/* Sliders row */}
      <div className="flex gap-4">
        {sliders.map(({ id, label }) => {
          const val = values[id] ?? 5;
          return (
            <div key={id} className="flex-1 min-w-0">
              <div className="flex items-center justify-between mb-2">
                <label htmlFor={`slider-${id}`} className="text-xs text-zinc-500">
                  {label}
                </label>
                <span className="text-xs font-bold text-zinc-200 tabular-nums">{val}</span>
              </div>
              <input
                id={`slider-${id}`}
                type="range"
                min={1} max={10} step={1}
                value={val}
                onChange={(e) => onChange(id, Number(e.target.value))}
                aria-label={label}
                aria-valuemin={1}
                aria-valuemax={10}
                aria-valuenow={val}
                className="w-full h-1.5 appearance-none rounded-full bg-zinc-700 accent-rose-400 cursor-pointer"
              />
            </div>
          );
        })}
      </div>

      {/* Journal (optional, collapsed by default) */}
      {showJournal && (
        journalOpen ? (
          <textarea
            value={journal}
            onChange={(e) => onJournalChange(e.target.value)}
            placeholder="Anything to note?"
            rows={3}
            className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-zinc-100 placeholder-zinc-600 focus:outline-none focus:border-rose-400 resize-none"
          />
        ) : (
          <button
            type="button"
            onClick={() => setJournalOpen(true)}
            className="flex items-center gap-1.5 text-xs text-zinc-600 hover:text-zinc-400 transition-colors"
          >
            <ChevronDown className="w-3 h-3" />
            Add a note
          </button>
        )
      )}
    </div>
  );
}
