"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { X, ArrowLeft, ArrowRight, Check, Loader2 } from "lucide-react";
import { Moon, Dumbbell, Crown, Heart, Activity, Coffee, Droplets, Pill, Monitor, Wine } from "lucide-react";
import { DOMAIN_REGISTRY } from "@/lib/metrics/domains";
import { getMetricsByDomain, getMetricById } from "@/lib/metrics/registry";
import type { MetricDefinition } from "@/lib/metrics/registry";
import type { Domain } from "@/lib/analysis/domains";

const DOMAIN_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  moon: Moon, dumbbell: Dumbbell, crown: Crown, heart: Heart,
  activity: Activity, coffee: Coffee, droplets: Droplets,
  pill: Pill, monitor: Monitor, wine: Wine,
};
const DOMAIN_TEXT: Record<string, string> = {
  "blue-400": "text-blue-400", "green-400": "text-green-400", "amber-400": "text-amber-400",
  "rose-400": "text-rose-400", "emerald-400": "text-emerald-400", "orange-400": "text-orange-400",
  "cyan-400": "text-cyan-400", "purple-400": "text-purple-400", "indigo-400": "text-indigo-400",
  "red-400": "text-red-400",
};
const DOMAIN_BG: Record<string, string> = {
  "blue-400": "bg-blue-500/10", "green-400": "bg-green-500/10", "amber-400": "bg-amber-500/10",
  "rose-400": "bg-rose-500/10", "emerald-400": "bg-emerald-500/10", "orange-400": "bg-orange-500/10",
  "cyan-400": "bg-cyan-500/10", "purple-400": "bg-purple-500/10", "indigo-400": "bg-indigo-500/10",
  "red-400": "bg-red-500/10",
};

// Exclude toggle (binary yes/no) and text (free-form) — all numeric, slider, stepper, and time metrics are valid goal targets
const GOAL_METRICS_FILTER = (m: MetricDefinition) =>
  m.inputType !== "toggle" && m.inputType !== "text";

function suggestTitle(metric: MetricDefinition, target: number): string {
  const t = metric.format(target);
  switch (metric.id) {
    case "sleep_total_duration":    return `Sleep ${target.toFixed(1)}h per night`;
    case "sleep_efficiency":        return `Achieve ${Math.round(target)}% sleep efficiency`;
    case "sleep_deep_pct":          return `Reach ${Math.round(target)}% deep sleep`;
    case "sleep_rem_pct":           return `Reach ${Math.round(target)}% REM sleep`;
    case "fitness_workouts_per_week": return `Work out ${Math.round(target)}× per week`;
    case "fitness_steps":           return `Walk ${Math.round(target).toLocaleString()} steps daily`;
    case "fitness_active_minutes":  return `Get ${Math.round(target)} active minutes daily`;
    case "fitness_resting_hr":      return `Keep resting HR below ${Math.round(target)} bpm`;
    case "fitness_hrv":             return `Achieve ${Math.round(target)} ms HRV`;
    case "chess_rating":            return `Reach ${Math.round(target)} chess rating`;
    case "chess_accuracy":          return `Maintain ${Math.round(target)}% accuracy`;
    case "chess_games_per_week":    return `Play ${Math.round(target)} games per week`;
    case "hydration_water_intake":  return `Drink ${target.toFixed(1)}L water daily`;
    case "caffeine_total_daily":    return `Keep caffeine under ${Math.round(target)} mg/day`;
    case "wellbeing_mood":          return `Maintain mood above ${target.toFixed(1)}/10`;
    case "wellbeing_energy":        return `Maintain energy above ${target.toFixed(1)}/10`;
    case "wellbeing_stress":        return `Keep stress below ${target.toFixed(1)}/10`;
    default:                        return `${metric.shortName}: ${t}`;
  }
}

interface Draft {
  domain: string;
  metricId: string;
  targetValue: string;
  targetDate: string;
  title: string;
}

const EMPTY_DRAFT: Draft = { domain: "", metricId: "", targetValue: "", targetDate: "", title: "" };

interface MetricCurrent { value: number | null; formatted: string | null }

export function AddGoalModal({ onClose }: { onClose: () => void }) {
  const router = useRouter();
  const [step, setStep] = useState<1 | 2 | 3 | 4>(1);
  const [draft, setDraft] = useState<Draft>({ ...EMPTY_DRAFT });
  const [metricCurrent, setMetricCurrent] = useState<MetricCurrent | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Fetch current value when metric is selected and we advance to step 3
  useEffect(() => {
    if (step === 3 && draft.metricId) {
      setMetricCurrent(null);
      fetch(`/api/metric-value?metricId=${encodeURIComponent(draft.metricId)}&period=30d`)
        .then((r) => r.json())
        .then((d) => setMetricCurrent({ value: d.value ?? null, formatted: d.formatted ?? null }))
        .catch(() => setMetricCurrent({ value: null, formatted: null }));
    }
  }, [step, draft.metricId]);

  // Auto-suggest title when target changes
  useEffect(() => {
    if (!draft.metricId || !draft.targetValue) return;
    const metric = getMetricById(draft.metricId);
    const target = parseFloat(draft.targetValue);
    if (metric && !isNaN(target) && target > 0) {
      setDraft((d) => ({ ...d, title: suggestTitle(metric, target) }));
    }
  }, [draft.metricId, draft.targetValue]);

  const domainDef = DOMAIN_REGISTRY.find((d) => d.id === draft.domain);
  const availableMetrics = draft.domain
    ? getMetricsByDomain(draft.domain as Domain).filter(GOAL_METRICS_FILTER)
    : [];
  const selectedMetric = draft.metricId ? getMetricById(draft.metricId) : null;

  async function save() {
    const target = parseFloat(draft.targetValue);
    if (!draft.domain || !draft.metricId || isNaN(target) || target <= 0 || !draft.title.trim()) {
      setError("Please complete all required steps.");
      return;
    }
    setSaving(true);
    setError(null);
    const res = await fetch("/api/goals", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: draft.title,
        domain: draft.domain,
        metric_id: draft.metricId,
        target_value: target,
        target_date: draft.targetDate || null,
      }),
    });
    setSaving(false);
    if (!res.ok) {
      const d = await res.json();
      setError(typeof d.error === "string" ? d.error : "Failed to create goal.");
      return;
    }
    router.refresh();
    onClose();
  }

  const inputCls = "w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2.5 text-sm text-zinc-50 placeholder-zinc-600 focus:outline-none focus:border-blue-500";
  const stepLabel = ["Domain", "Metric", "Target", "Date"][step - 1];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-zinc-900 border border-zinc-800 rounded-2xl w-full max-w-md shadow-2xl flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-zinc-800 shrink-0">
          <div className="flex items-center gap-3">
            {step > 1 && (
              <button onClick={() => setStep((s) => (s - 1) as 1 | 2 | 3 | 4)} className="p-1 text-zinc-500 hover:text-zinc-200 transition-colors">
                <ArrowLeft className="w-4 h-4" />
              </button>
            )}
            <div>
              <p className="text-[10px] font-semibold text-zinc-500 uppercase tracking-widest">Step {step} of 4</p>
              <h2 className="text-sm font-semibold text-zinc-50">{stepLabel}</h2>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-md text-zinc-500 hover:text-zinc-200 hover:bg-zinc-800 transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <div className="overflow-y-auto flex-1 p-5">
          {/* Step 1: Domain */}
          {step === 1 && (
            <div className="space-y-4">
              <p className="text-sm text-zinc-400">Which area of your life does this goal relate to?</p>
              <div className="grid grid-cols-2 gap-2">
                {DOMAIN_REGISTRY.map((d) => {
                  const Icon = DOMAIN_ICONS[d.icon] ?? Activity;
                  const ic = DOMAIN_TEXT[d.color] ?? "text-zinc-400";
                  const bg = DOMAIN_BG[d.color] ?? "bg-zinc-700";
                  const sel = draft.domain === d.id;
                  return (
                    <button
                      key={d.id}
                      type="button"
                      onClick={() => { setDraft({ ...EMPTY_DRAFT, domain: d.id }); setStep(2); }}
                      className={`flex items-center gap-2.5 px-3 py-3 rounded-xl border text-left transition-colors ${sel ? "border-blue-500/60 bg-blue-500/10" : "border-zinc-700 bg-zinc-800/50 hover:border-zinc-600"}`}
                    >
                      <div className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${bg}`}>
                        <Icon className={`w-3.5 h-3.5 ${ic}`} />
                      </div>
                      <span className="text-xs font-semibold text-zinc-50">{d.name}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Step 2: Metric */}
          {step === 2 && (
            <div className="space-y-3">
              <p className="text-sm text-zinc-400">Which metric do you want to target?</p>
              {availableMetrics.length === 0 && (
                <p className="text-xs text-zinc-500">No numeric metrics available for this domain.</p>
              )}
              {availableMetrics.map((m) => {
                const sel = draft.metricId === m.id;
                return (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => { setDraft((d) => ({ ...d, metricId: m.id, targetValue: "", title: "" })); setStep(3); }}
                    className={`w-full flex items-center justify-between px-4 py-3 rounded-xl border text-left transition-colors ${sel ? "border-blue-500/60 bg-blue-500/10" : "border-zinc-700 bg-zinc-800/50 hover:border-zinc-600"}`}
                  >
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-zinc-50">{m.name}</p>
                      <p className="text-xs text-zinc-500 truncate mt-0.5">{m.description}</p>
                    </div>
                    {sel && <Check className="w-4 h-4 text-blue-400 shrink-0 ml-2" />}
                  </button>
                );
              })}
            </div>
          )}

          {/* Step 3: Target */}
          {step === 3 && selectedMetric && (
            <div className="space-y-5">
              <div>
                <p className="text-xs font-semibold text-zinc-500 uppercase tracking-widest mb-1">
                  {domainDef?.name} · {selectedMetric.name}
                </p>
                <p className="text-sm text-zinc-400">{selectedMetric.description}</p>
              </div>

              {/* Context */}
              <div className="bg-zinc-800/50 rounded-xl p-4 space-y-2 text-xs text-zinc-400">
                {metricCurrent === null ? (
                  <p className="flex items-center gap-2"><Loader2 className="w-3 h-3 animate-spin" /> Loading your data…</p>
                ) : metricCurrent.formatted ? (
                  <p><span className="text-zinc-300 font-medium">Your 30-day avg:</span> {metricCurrent.formatted}</p>
                ) : (
                  <p>No data recorded yet for this metric.</p>
                )}
                {selectedMetric.healthyRange && (
                  <p><span className="text-zinc-300 font-medium">Healthy range:</span> {selectedMetric.healthyRange.label}</p>
                )}
              </div>

              <div>
                <label className="block text-xs font-medium text-zinc-400 mb-1.5">
                  Target value ({selectedMetric.unitLabel || selectedMetric.unit}) *
                </label>
                <input
                  type="number"
                  value={draft.targetValue}
                  onChange={(e) => setDraft((d) => ({ ...d, targetValue: e.target.value }))}
                  placeholder={selectedMetric.inputConfig?.placeholder ?? `Enter ${selectedMetric.unitLabel || selectedMetric.unit}`}
                  min={selectedMetric.inputConfig?.min ?? 0}
                  max={selectedMetric.inputConfig?.max}
                  step={selectedMetric.inputConfig?.step ?? "any"}
                  className={inputCls}
                  autoFocus
                />
                {selectedMetric.inputType === "time" && (
                  <p className="text-xs text-zinc-500 mt-1.5">Enter as decimal hours — e.g. 22.5 for 10:30 PM, 7.0 for 7:00 AM</p>
                )}
              </div>

              <div>
                <label className="block text-xs font-medium text-zinc-400 mb-1.5">Goal title (editable)</label>
                <input
                  type="text"
                  value={draft.title}
                  onChange={(e) => setDraft((d) => ({ ...d, title: e.target.value }))}
                  placeholder="Auto-generated when you enter a target"
                  className={inputCls}
                />
              </div>

              <button
                type="button"
                disabled={!draft.targetValue || parseFloat(draft.targetValue) <= 0}
                onClick={() => setStep(4)}
                className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-blue-500 hover:bg-blue-400 text-zinc-950 font-semibold transition-colors disabled:opacity-40"
              >
                Continue <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          )}

          {/* Step 4: Date + Save */}
          {step === 4 && (
            <div className="space-y-5">
              <div>
                <p className="text-sm text-zinc-400">Set an optional deadline for this goal.</p>
              </div>

              <div className="bg-zinc-800/50 rounded-xl p-4 text-sm space-y-1">
                <p className="text-zinc-400">
                  <span className="text-zinc-200 font-medium">Goal:</span> {draft.title}
                </p>
                <p className="text-zinc-400">
                  <span className="text-zinc-200 font-medium">Target:</span>{" "}
                  {selectedMetric ? selectedMetric.format(parseFloat(draft.targetValue)) : draft.targetValue}{" "}
                  {selectedMetric?.unitLabel}
                </p>
              </div>

              <div>
                <label className="block text-xs font-medium text-zinc-400 mb-1.5">Achieve by (optional)</label>
                <input
                  type="date"
                  value={draft.targetDate}
                  onChange={(e) => setDraft((d) => ({ ...d, targetDate: e.target.value }))}
                  className={inputCls}
                />
              </div>

              {error && <p className="text-xs text-red-400">{error}</p>}

              <button
                type="button"
                onClick={save}
                disabled={saving}
                className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-blue-500 hover:bg-blue-400 text-zinc-950 font-semibold transition-colors disabled:opacity-50"
              >
                {saving ? <><Loader2 className="w-4 h-4 animate-spin" /> Saving…</> : "Save goal"}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
