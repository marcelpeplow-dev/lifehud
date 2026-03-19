"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { X } from "lucide-react";

interface Preset {
  label: string;
  fields: {
    title: string;
    category: string;
    metric_name: string;
    target_value: number;
    target_unit: string;
    target_frequency: string;
  };
}

const PRESETS: Preset[] = [
  {
    label: "Sleep 8h/night",
    fields: { title: "Sleep 8 hours per night", category: "sleep", metric_name: "sleep_duration", target_value: 480, target_unit: "min", target_frequency: "daily" },
  },
  {
    label: "Work out 4×/week",
    fields: { title: "Work out 4 times per week", category: "fitness", metric_name: "weekly_workouts", target_value: 4, target_unit: "workouts", target_frequency: "weekly" },
  },
  {
    label: "10k steps/day",
    fields: { title: "10,000 steps per day", category: "fitness", metric_name: "steps", target_value: 10000, target_unit: "steps", target_frequency: "daily" },
  },
];

const METRIC_OPTIONS = [
  { label: "Sleep Duration",     value: "sleep_duration",  unit: "min",      frequency: "daily"  },
  { label: "Daily Steps",        value: "steps",           unit: "steps",    frequency: "daily"  },
  { label: "Weekly Workouts",    value: "weekly_workouts", unit: "workouts", frequency: "weekly" },
  { label: "Active Minutes",     value: "active_minutes",  unit: "min",      frequency: "daily"  },
  { label: "Resting Heart Rate", value: "resting_hr",      unit: "bpm",      frequency: "daily"  },
  { label: "HRV Average",        value: "hrv_average",     unit: "ms",       frequency: "daily"  },
  { label: "Calories Burned",    value: "calories_burned", unit: "kcal",     frequency: "daily"  },
] as const;

const EMPTY = { title: "", category: "general", metric_name: "", target_value: "", target_unit: "", target_frequency: "daily", target_date: "" };

export function AddGoalModal({ onClose }: { onClose: () => void }) {
  const router = useRouter();
  const [form, setForm] = useState<typeof EMPTY>({ ...EMPTY });
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  function applyPreset(preset: Preset) {
    setForm({ ...EMPTY, ...preset.fields, target_value: String(preset.fields.target_value), target_date: "" });
  }

  function set(field: keyof typeof EMPTY, value: string) {
    setForm((f) => ({ ...f, [field]: value }));
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const targetVal = Number(form.target_value);
    if (!form.title || !form.metric_name || !form.target_unit || isNaN(targetVal) || targetVal <= 0) {
      setError("Please fill in all required fields with valid values.");
      return;
    }
    setSaving(true);
    const res = await fetch("/api/goals", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: form.title,
        category: form.category,
        metric_name: form.metric_name,
        target_value: targetVal,
        target_unit: form.target_unit,
        target_frequency: form.target_frequency,
        target_date: form.target_date || null,
      }),
    });
    setSaving(false);
    if (!res.ok) {
      const data = await res.json();
      setError(typeof data.error === "string" ? data.error : "Failed to create goal.");
      return;
    }
    router.refresh();
    onClose();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-zinc-900 border border-zinc-800 rounded-2xl w-full max-w-md shadow-2xl">
        <div className="flex items-center justify-between p-5 border-b border-zinc-800">
          <h2 className="text-base font-semibold text-zinc-50">Add a goal</h2>
          <button onClick={onClose} className="p-1.5 rounded-md text-zinc-500 hover:text-zinc-200 hover:bg-zinc-800 transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-5">
          {/* Presets */}
          <p className="text-xs font-medium text-zinc-400 mb-2">Quick presets</p>
          <div className="flex gap-2 flex-wrap mb-5">
            {PRESETS.map((p) => (
              <button
                key={p.label}
                type="button"
                onClick={() => applyPreset(p)}
                className="text-xs px-3 py-1.5 rounded-lg bg-zinc-800 text-zinc-300 hover:bg-zinc-700 hover:text-zinc-50 transition-colors"
              >
                {p.label}
              </button>
            ))}
          </div>

          <form onSubmit={submit} className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-zinc-400 mb-1.5">Title *</label>
              <input
                type="text"
                value={form.title}
                onChange={(e) => set("title", e.target.value)}
                placeholder="e.g. Sleep 8 hours per night"
                className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-zinc-50 placeholder-zinc-600 focus:outline-none focus:border-emerald-500"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-zinc-400 mb-1.5">Category *</label>
                <select
                  value={form.category}
                  onChange={(e) => set("category", e.target.value)}
                  className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-zinc-50 focus:outline-none focus:border-emerald-500"
                >
                  <option value="sleep">Sleep</option>
                  <option value="fitness">Fitness</option>
                  <option value="recovery">Recovery</option>
                  <option value="general">General</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-zinc-400 mb-1.5">Frequency *</label>
                <select
                  value={form.target_frequency}
                  onChange={(e) => set("target_frequency", e.target.value)}
                  className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-zinc-50 focus:outline-none focus:border-emerald-500"
                >
                  <option value="daily">Daily</option>
                  <option value="weekly">Weekly</option>
                  <option value="monthly">Monthly</option>
                </select>
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-zinc-400 mb-1.5">Metric *</label>
              <select
                value={form.metric_name}
                onChange={(e) => {
                  const opt = METRIC_OPTIONS.find((m) => m.value === e.target.value);
                  setForm((f) => ({
                    ...f,
                    metric_name: e.target.value,
                    target_unit: opt?.unit ?? f.target_unit,
                    target_frequency: opt?.frequency ?? f.target_frequency,
                  }));
                }}
                className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-zinc-50 focus:outline-none focus:border-emerald-500"
              >
                <option value="">Select a metric…</option>
                {METRIC_OPTIONS.map((m) => (
                  <option key={m.value} value={m.value}>{m.label}</option>
                ))}
              </select>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-zinc-400 mb-1.5">Target value *</label>
                <input
                  type="number"
                  value={form.target_value}
                  onChange={(e) => set("target_value", e.target.value)}
                  placeholder="e.g. 480"
                  min="0"
                  className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-zinc-50 placeholder-zinc-600 focus:outline-none focus:border-emerald-500"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-zinc-400 mb-1.5">Unit *</label>
                <input
                  type="text"
                  value={form.target_unit}
                  onChange={(e) => set("target_unit", e.target.value)}
                  placeholder="e.g. min, steps"
                  className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-zinc-50 placeholder-zinc-600 focus:outline-none focus:border-emerald-500"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-zinc-400 mb-1.5">Target date (optional)</label>
              <input
                type="date"
                value={form.target_date}
                onChange={(e) => set("target_date", e.target.value)}
                className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-zinc-50 focus:outline-none focus:border-emerald-500"
              />
            </div>

            {error && <p className="text-xs text-red-400">{error}</p>}

            <button
              type="submit"
              disabled={saving}
              className="w-full py-2.5 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-zinc-950 text-sm font-semibold transition-colors disabled:opacity-50"
            >
              {saving ? "Saving…" : "Add goal"}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
