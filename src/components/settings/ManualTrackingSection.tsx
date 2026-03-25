"use client";

import { useState, useCallback } from "react";
import {
  Heart, Coffee, Droplets, Pill, Monitor, Wine,
  ChevronDown, ChevronUp,
} from "lucide-react";
import { getManualDomains, type DomainDefinition } from "@/lib/metrics/domains";
import { getMetricsByDomain } from "@/lib/metrics/registry";
import type { Domain } from "@/lib/analysis/domains";

// Icon lookup for manual domain icons
const DOMAIN_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  heart: Heart, coffee: Coffee, droplets: Droplets,
  pill: Pill, monitor: Monitor, wine: Wine,
};

export interface ManualConfigRow {
  domain: string;
  metric_id: string;
  enabled: boolean;
  display_order: number;
}

interface Props { initialConfigs: ManualConfigRow[] }

function Toggle({ on, onChange }: { on: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      onClick={() => onChange(!on)}
      className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors focus-visible:outline-none ${
        on ? "bg-emerald-500" : "bg-zinc-700"
      }`}
    >
      <span
        className={`pointer-events-none inline-block h-4 w-4 rounded-full bg-white shadow-lg transition-transform ${
          on ? "translate-x-4" : "translate-x-0"
        }`}
      />
    </button>
  );
}

function DomainCard({
  domain, enabledMap, onToggleDomain, onToggleMetric,
}: {
  domain: DomainDefinition;
  enabledMap: Map<string, boolean>;
  onToggleDomain: (active: boolean) => void;
  onToggleMetric: (metricId: string, value: boolean) => void;
}) {
  const metrics = getMetricsByDomain(domain.id as Domain);
  const active = metrics.some((m) => enabledMap.get(m.id) === true);
  const [expanded, setExpanded] = useState(active);
  const Icon = DOMAIN_ICONS[domain.icon] ?? Heart;

  function handleDomainToggle(v: boolean) {
    setExpanded(v);
    onToggleDomain(v);
  }

  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 overflow-hidden">
      <div className="flex items-center gap-3 px-4 py-3">
        <span className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 bg-zinc-800`}>
          <Icon className={`w-4 h-4 text-${domain.color}`} />
        </span>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-zinc-100">{domain.name}</p>
          <p className="text-xs text-zinc-500 truncate">{domain.description}</p>
        </div>
        <button
          type="button"
          onClick={() => setExpanded((e) => !e)}
          className="p-1 text-zinc-600 hover:text-zinc-400 transition-colors"
          aria-label={expanded ? "Collapse" : "Expand"}
        >
          {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
        </button>
        <Toggle on={active} onChange={handleDomainToggle} />
      </div>

      {expanded && (
        <div className="border-t border-zinc-800 px-4 py-2 space-y-1">
          {metrics.map((metric) => {
            const on = enabledMap.get(metric.id) ?? false;
            return (
              <div key={metric.id} className="flex items-center gap-3 py-2">
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium text-zinc-300">{metric.name}</p>
                  <p className="text-xs text-zinc-600">{metric.description}</p>
                </div>
                {metric.detectorIds.length > 0 && (
                  <span className="text-xs text-zinc-600 shrink-0">
                    {metric.detectorIds.length} detector{metric.detectorIds.length !== 1 ? "s" : ""}
                  </span>
                )}
                <Toggle on={on} onChange={(v) => onToggleMetric(metric.id, v)} />
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

export function ManualTrackingSection({ initialConfigs }: Props) {
  const buildMap = (configs: ManualConfigRow[]) => {
    const map = new Map<string, boolean>();
    for (const c of configs) map.set(c.metric_id, c.enabled);
    return map;
  };

  const [enabledMap, setEnabledMap] = useState(() => buildMap(initialConfigs));
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState<number | null>(null);
  const manualDomains = getManualDomains();

  const persist = useCallback(async (map: Map<string, boolean>) => {
    setSaving(true);
    try {
      const configs = manualDomains.flatMap((domain, di) =>
        getMetricsByDomain(domain.id as Domain).map((metric, mi) => ({
          domain: domain.id,
          metric_id: metric.id,
          enabled: map.get(metric.id) ?? false,
          display_order: di * 100 + mi,
        })),
      );
      const res = await fetch("/api/manual-config", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ configs }),
      });
      if (res.ok) setSavedAt(Date.now());
    } finally {
      setSaving(false);
    }
  }, [manualDomains]);

  const toggleDomain = useCallback(async (domain: DomainDefinition, active: boolean) => {
    const metrics = getMetricsByDomain(domain.id as Domain);
    const next = new Map(enabledMap);
    if (active) {
      const toEnable = domain.defaultMetrics.length > 0
        ? domain.defaultMetrics
        : metrics.map((m) => m.id);
      for (const id of toEnable) next.set(id, true);
    } else {
      for (const m of metrics) next.set(m.id, false);
    }
    setEnabledMap(next);
    await persist(next);
  }, [enabledMap, persist]);

  const toggleMetric = useCallback(async (metricId: string, value: boolean) => {
    const next = new Map(enabledMap);
    next.set(metricId, value);
    setEnabledMap(next);
    await persist(next);
  }, [enabledMap, persist]);

  return (
    <div className="space-y-2">
      {manualDomains.map((domain) => (
        <DomainCard
          key={domain.id}
          domain={domain}
          enabledMap={enabledMap}
          onToggleDomain={(v) => toggleDomain(domain, v)}
          onToggleMetric={toggleMetric}
        />
      ))}
      <div className="h-5 flex items-center">
        {saving && <p className="text-xs text-zinc-500">Saving…</p>}
        {!saving && savedAt && (
          <p className="text-xs text-emerald-500">Saved</p>
        )}
      </div>
    </div>
  );
}
