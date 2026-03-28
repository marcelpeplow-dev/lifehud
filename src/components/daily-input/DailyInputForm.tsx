"use client";

import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Check } from "lucide-react";
import { format } from "date-fns";
import { BUCKET_DEFINITIONS } from "@/lib/metrics/buckets";
import { BucketSelector } from "./BucketSelector";
import { WellbeingSliders } from "./WellbeingSliders";
import { MetricInput } from "./MetricInput";
import { getMetricById } from "@/lib/metrics/registry";
import type { MetricDefinition } from "@/lib/metrics/registry";

const BUCKET_IDS = new Set(BUCKET_DEFINITIONS.map((b) => b.metricId));
const WELLBEING_SLIDER_IDS = ["wellbeing_mood", "wellbeing_energy", "wellbeing_stress", "wellbeing_focus"];
const WELLBEING_CORE = ["wellbeing_mood", "wellbeing_energy", "wellbeing_stress"];
const TOGGLE_IDS = ["supplements_taken", "substances_cannabis"];
const COVERED_IDS = new Set([...BUCKET_IDS, ...WELLBEING_SLIDER_IDS, "wellbeing_journal", ...TOGGLE_IDS]);

interface EnabledMetric { domain: string; metric_id: string }

interface Props {
  enabledMetrics: EnabledMetric[];
  initialValues: Record<string, number>;
  initialJournal: string;
  date: string;
}

export function DailyInputForm({ enabledMetrics, initialValues, initialJournal, date }: Props) {
  const router = useRouter();
  const [values, setValues] = useState<Record<string, number>>(initialValues);
  const [journal, setJournal] = useState(initialJournal);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const enabledSet = new Set(enabledMetrics.map((m) => m.metric_id));

  const hasWellbeing = WELLBEING_CORE.some((id) => enabledSet.has(id));
  const activeBuckets = BUCKET_DEFINITIONS.filter((b) => enabledSet.has(b.metricId));
  const activeToggleIds = TOGGLE_IDS.filter((id) => enabledSet.has(id));
  const fallbackMetrics: MetricDefinition[] = enabledMetrics
    .filter((m) => !COVERED_IDS.has(m.metric_id))
    .flatMap((m) => { const d = getMetricById(m.metric_id); return d ? [d] : []; });

  // Section-level progress
  const wellbeingComplete = hasWellbeing &&
    WELLBEING_CORE.filter((id) => enabledSet.has(id)).every((id) => values[id] != null);
  const totalSections =
    (hasWellbeing ? 1 : 0) + activeBuckets.length + activeToggleIds.length + fallbackMetrics.length;
  const completedSections =
    (wellbeingComplete ? 1 : 0) +
    activeBuckets.filter((bd) => values[bd.metricId] != null).length +
    activeToggleIds.length +
    fallbackMetrics.filter((m) => values[m.id] != null).length;

  const handleChange = useCallback((metricId: string, value: number) => {
    setValues((prev) => ({ ...prev, [metricId]: value }));
    setSaved(false);
  }, []);

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    try {
      const entries = Object.entries(values)
        .filter(([id]) => enabledSet.has(id))
        .map(([metric_id, value]) => ({ metric_id, date, value }));

      const meRes = await fetch("/api/manual-entries", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ entries }),
      });
      if (!meRes.ok) throw new Error("Failed to save entries");

      const mood = values["wellbeing_mood"];
      const energy = values["wellbeing_energy"];
      const stress = values["wellbeing_stress"];
      if (hasWellbeing && mood != null && energy != null && stress != null) {
        await fetch("/api/checkins", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            mood: Math.round(mood),
            energy: Math.round(energy),
            stress: Math.round(stress),
            notes: journal || null,
          }),
        });
      }

      setSaved(true);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed");
    } finally {
      setSaving(false);
    }
  };

  if (!hasWellbeing && activeBuckets.length === 0 && activeToggleIds.length === 0 && fallbackMetrics.length === 0) {
    return (
      <div className="text-center py-16 text-zinc-500">
        <p className="text-sm">No metrics enabled yet.</p>
        <p className="text-xs mt-1">
          Enable domains in{" "}
          <a href="/dashboard/settings" className="text-blue-400 underline">
            Settings → Manual Tracking
          </a>.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Progress */}
      <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs text-zinc-400">Today&apos;s progress</span>
          <span className="text-xs font-medium text-zinc-300">{completedSections} / {totalSections} sections</span>
        </div>
        <div className="h-1.5 bg-zinc-800 rounded-full overflow-hidden">
          <div
            className="h-full bg-blue-500 rounded-full transition-all duration-300"
            style={{ width: totalSections > 0 ? `${(completedSections / totalSections) * 100}%` : "0%" }}
          />
        </div>
      </div>

      {/* 1. Wellbeing sliders */}
      {hasWellbeing && (
        <WellbeingSliders
          values={values}
          onChange={handleChange}
          showFocus={enabledSet.has("wellbeing_focus")}
          showJournal={enabledSet.has("wellbeing_journal")}
          journal={journal}
          onJournalChange={setJournal}
        />
      )}

      {/* 2. Bucket selectors */}
      {activeBuckets.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {activeBuckets.map((bd) => (
            <BucketSelector
              key={bd.metricId}
              domain={bd}
              value={values[bd.metricId]}
              onChange={handleChange}
            />
          ))}
        </div>
      )}

      {/* 3. Toggles: supplements_taken, substances_cannabis */}
      {activeToggleIds.length > 0 && (
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl divide-y divide-zinc-800/60">
          {activeToggleIds.map((id) => {
            const metric = getMetricById(id);
            if (!metric) return null;
            return (
              <div key={id} className="flex items-center justify-between px-4 py-3">
                <span className="text-sm text-zinc-200">{metric.name}</span>
                <MetricInput metric={metric} value={values[id]} onChange={handleChange} />
              </div>
            );
          })}
        </div>
      )}

      {/* 4. Fallback MetricInput for any other enabled metrics */}
      {fallbackMetrics.length > 0 && (
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl divide-y divide-zinc-800/60">
          {fallbackMetrics.map((metric) => (
            <div key={metric.id} className="flex items-center gap-4 px-4 py-3">
              <div className="flex-1 min-w-0">
                <p className="text-sm text-zinc-200">{metric.name}</p>
                {metric.description && (
                  <p className="text-xs text-zinc-600 mt-0.5">{metric.description}</p>
                )}
              </div>
              <div className="shrink-0">
                <MetricInput metric={metric} value={values[metric.id]} onChange={handleChange} />
              </div>
            </div>
          ))}
        </div>
      )}

      {error && <p className="text-sm text-red-400">{error}</p>}

      {/* Done button */}
      <button
        onClick={handleSave}
        disabled={saving}
        className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-blue-500 hover:bg-blue-400 disabled:opacity-50 text-sm font-semibold text-zinc-950 transition-colors"
      >
        {saved ? <Check className="w-4 h-4" /> : null}
        {saving ? "Saving…" : saved ? "Saved!" : `Done for ${format(new Date(date + "T12:00:00"), "MMMM d")}`}
      </button>
    </div>
  );
}
