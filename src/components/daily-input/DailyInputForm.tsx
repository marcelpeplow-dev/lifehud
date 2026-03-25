"use client";

import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Check } from "lucide-react";
import { format } from "date-fns";
import {
  Heart, Coffee, Droplets, Pill, Monitor, Wine,
} from "lucide-react";
import { getMetricsByDomain } from "@/lib/metrics/registry";
import { getManualDomains } from "@/lib/metrics/domains";
import { MetricInput } from "./MetricInput";
import type { Domain } from "@/lib/analysis/domains";

const DOMAIN_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  heart: Heart, coffee: Coffee, droplets: Droplets,
  pill: Pill, monitor: Monitor, wine: Wine,
};

const WELLBEING_NUMERIC = ["wellbeing_mood", "wellbeing_energy", "wellbeing_stress", "wellbeing_focus"];

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

  // Group enabled metrics by domain
  const manualDomains = getManualDomains();
  const domainSections = manualDomains
    .map((domain) => ({
      domain,
      metrics: getMetricsByDomain(domain.id as Domain).filter((m) => enabledSet.has(m.id)),
    }))
    .filter((s) => s.metrics.length > 0);

  // Completion progress
  const totalMetrics = domainSections.reduce((n, s) => n + s.metrics.length, 0);
  const filledMetrics = domainSections.reduce(
    (n, s) => n + s.metrics.filter((m) =>
      m.inputType === "text"
        ? journal.trim().length > 0
        : values[m.id] != null,
    ).length,
    0,
  );

  const handleChange = useCallback((metricId: string, value: number) => {
    setValues((prev) => ({ ...prev, [metricId]: value }));
    setSaved(false);
  }, []);

  const handleTextChange = useCallback((_: string, value: string) => {
    setJournal(value);
    setSaved(false);
  }, []);

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    try {
      // Build numeric entries for manual_entries table
      const entries = Object.entries(values)
        .filter(([id]) => enabledSet.has(id))
        .map(([metric_id, value]) => ({ metric_id, date, value }));

      const meRes = await fetch("/api/manual-entries", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ entries }),
      });
      if (!meRes.ok) throw new Error("Failed to save entries");

      // Backward compat: also write wellbeing to daily_checkins
      const mood = values["wellbeing_mood"];
      const energy = values["wellbeing_energy"];
      const stress = values["wellbeing_stress"];
      const hasWellbeing = WELLBEING_NUMERIC.some((id) => enabledSet.has(id));
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

  if (domainSections.length === 0) {
    return (
      <div className="text-center py-16 text-zinc-500">
        <p className="text-sm">No metrics enabled yet.</p>
        <p className="text-xs mt-1">Enable domains in <a href="/dashboard/settings" className="text-emerald-400 underline">Settings → Manual Tracking</a>.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Progress bar */}
      <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs text-zinc-400">Today&apos;s progress</span>
          <span className="text-xs font-medium text-zinc-300">
            {filledMetrics} / {totalMetrics} metrics
          </span>
        </div>
        <div className="h-1.5 bg-zinc-800 rounded-full overflow-hidden">
          <div
            className="h-full bg-emerald-500 rounded-full transition-all duration-300"
            style={{ width: totalMetrics > 0 ? `${(filledMetrics / totalMetrics) * 100}%` : "0%" }}
          />
        </div>
      </div>

      {/* Domain sections */}
      {domainSections.map(({ domain, metrics }) => {
        const Icon = DOMAIN_ICONS[domain.icon] ?? Heart;
        return (
          <div key={domain.id} className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden">
            <div className="flex items-center gap-3 px-5 py-3 border-b border-zinc-800">
              <Icon className={`w-4 h-4 text-${domain.color} shrink-0`} />
              <h3 className="text-sm font-semibold text-zinc-100">{domain.name}</h3>
            </div>
            <div className="divide-y divide-zinc-800/60">
              {metrics.map((metric) => (
                <div key={metric.id} className="flex items-center gap-4 px-5 py-3">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-zinc-200">{metric.name}</p>
                    <p className="text-xs text-zinc-600 mt-0.5">{metric.description}</p>
                  </div>
                  <div className="shrink-0">
                    <MetricInput
                      metric={metric}
                      value={values[metric.id]}
                      textValue={metric.inputType === "text" ? journal : undefined}
                      onChange={handleChange}
                      onTextChange={metric.inputType === "text" ? handleTextChange : undefined}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
        );
      })}

      {/* Save */}
      {error && <p className="text-sm text-red-400">{error}</p>}
      <button
        onClick={handleSave}
        disabled={saving}
        className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-emerald-500 hover:bg-emerald-400 disabled:opacity-50 text-sm font-semibold text-zinc-950 transition-colors"
      >
        {saved ? <Check className="w-4 h-4" /> : null}
        {saving ? "Saving…" : saved ? "Saved!" : `Save for ${format(new Date(date + "T12:00:00"), "MMMM d")}`}
      </button>
    </div>
  );
}
