"use client";

import { useState, useEffect, useCallback } from "react";
import { X, ChevronLeft, BarChart2, TrendingUp, AreaChart, Check } from "lucide-react";
import {
  Moon, Dumbbell, Crown, Heart, Activity,
  Coffee, Droplets, Pill, Monitor, Wine,
} from "lucide-react";
import { DOMAIN_REGISTRY } from "@/lib/metrics/domains";
import { getMetricsByDomain, getMetricById } from "@/lib/metrics/registry";
import { GraphChart, getDomainColor } from "./GraphChart";
import type { ChartType } from "./GraphChart";
import type { SeriesPoint } from "@/lib/metrics/fetch-series";

const DOMAIN_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  moon: Moon, dumbbell: Dumbbell, crown: Crown, heart: Heart,
  activity: Activity, coffee: Coffee, droplets: Droplets,
  pill: Pill, monitor: Monitor, wine: Wine,
};

export interface GraphConfig {
  metrics: Array<{ metricId: string; domain: string }>;
  chartType: ChartType;
  days: 7 | 30 | 90;
}

interface GraphBuilderModalProps {
  position: number;
  initialConfig?: GraphConfig | null;
  onSave: (config: GraphConfig) => void;
  onClose: () => void;
  configType?: string;
  pageDomain?: string | null;
  defaultDomain?: string;
}

type Step = "metrics" | "chart_type" | "time_range" | "preview";

const CHART_TYPES: Array<{ type: ChartType; label: string; desc: string; Icon: React.ComponentType<{ className?: string }> }> = [
  { type: "line", label: "Line", desc: "Best for trends", Icon: TrendingUp },
  { type: "bar", label: "Bar", desc: "Daily values", Icon: BarChart2 },
  { type: "area", label: "Area", desc: "Cumulative view", Icon: AreaChart },
];

export function GraphBuilderModal({ position, initialConfig, onSave, onClose, configType = "graph", pageDomain = null, defaultDomain }: GraphBuilderModalProps) {
  const [step, setStep] = useState<Step>("metrics");
  const [domainFilter, setDomainFilter] = useState<string | null>(defaultDomain ?? null);
  const [selectedMetrics, setSelectedMetrics] = useState<Array<{ metricId: string; domain: string }>>(initialConfig?.metrics ?? []);
  const [chartType, setChartType] = useState<ChartType>(initialConfig?.chartType ?? "line");
  const [days, setDays] = useState<7 | 30 | 90>(initialConfig?.days ?? 30);
  const [seriesData, setSeriesData] = useState<Record<string, SeriesPoint[]>>({});
  const [loadingPreview, setLoadingPreview] = useState(false);

  useEffect(() => {
    function onKey(e: KeyboardEvent) { if (e.key === "Escape") onClose(); }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const fetchPreview = useCallback(async () => {
    if (selectedMetrics.length === 0) return;
    setLoadingPreview(true);
    try {
      const results = await Promise.all(
        selectedMetrics.map((m) =>
          fetch(`/api/metric-series?metricId=${m.metricId}&days=${days}`)
            .then((r) => r.json() as Promise<{ series: SeriesPoint[] }>)
            .then((d) => ({ metricId: m.metricId, series: d.series ?? [] }))
        )
      );
      const map: Record<string, SeriesPoint[]> = {};
      for (const r of results) map[r.metricId] = r.series;
      setSeriesData(map);
    } catch { /* silent */ } finally {
      setLoadingPreview(false);
    }
  }, [selectedMetrics, days]);

  function handleMetricToggle(metricId: string, domainId: string) {
    setSelectedMetrics((prev) => {
      const exists = prev.find((m) => m.metricId === metricId);
      if (exists) return prev.filter((m) => m.metricId !== metricId);
      if (prev.length >= 2) return prev;
      return [...prev, { metricId, domain: domainId }];
    });
  }

  async function handleSave() {
    const config: GraphConfig = { metrics: selectedMetrics, chartType, days };
    await fetch("/api/dashboard-config", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ config_type: configType, position, domain: pageDomain ?? null, config }),
    });
    onSave(config);
  }

  const filteredMetrics = domainFilter
    ? getMetricsByDomain(domainFilter as Parameters<typeof getMetricsByDomain>[0]).filter((m) => m.inputType !== "text" && m.unit !== "category" && m.unit !== "name" && m.unit !== "ratio")
    : [];

  const stepTitles: Record<Step, string> = {
    metrics: "Choose metrics (up to 2)",
    chart_type: "Chart type",
    time_range: "Time range",
    preview: "Preview",
  };

  const stepOrder: Step[] = ["metrics", "chart_type", "time_range", "preview"];
  const stepIndex = stepOrder.indexOf(step);

  function goNext() {
    const next = stepOrder[stepIndex + 1];
    if (next === "preview") fetchPreview();
    if (next) setStep(next);
  }

  function goBack() {
    const prev = stepOrder[stepIndex - 1];
    if (prev) setStep(prev);
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="w-full sm:max-w-lg bg-zinc-900 border border-zinc-800 rounded-t-2xl sm:rounded-2xl max-h-[85vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-zinc-800 shrink-0">
          <div className="flex items-center gap-2">
            {stepIndex > 0 && (
              <button onClick={goBack} className="p-1 rounded-lg text-zinc-400 hover:text-zinc-50 hover:bg-zinc-800 transition-colors">
                <ChevronLeft className="w-4 h-4" />
              </button>
            )}
            <h2 className="text-sm font-semibold text-zinc-50">{stepTitles[step]}</h2>
          </div>
          <button onClick={onClose} className="p-1 rounded-lg text-zinc-400 hover:text-zinc-50 hover:bg-zinc-800 transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content */}
        <div className="overflow-y-auto flex-1 p-4">
          {/* Step 1: Metrics */}
          {step === "metrics" && (
            <div className="space-y-4">
              {selectedMetrics.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {selectedMetrics.map((m) => {
                    const metric = getMetricById(m.metricId);
                    const color = getDomainColor(m.domain);
                    return (
                      <button
                        key={m.metricId}
                        onClick={() => handleMetricToggle(m.metricId, m.domain)}
                        className="flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium border transition-colors"
                        style={{ borderColor: color, color }}
                      >
                        {metric?.shortName ?? m.metricId}
                        <X className="w-3 h-3" />
                      </button>
                    );
                  })}
                </div>
              )}
              {/* Domain filter pills */}
              <div className="flex flex-wrap gap-2">
                {DOMAIN_REGISTRY.map((domain) => {
                  const Icon = DOMAIN_ICONS[domain.icon] ?? Activity;
                  const active = domainFilter === domain.id;
                  return (
                    <button
                      key={domain.id}
                      onClick={() => setDomainFilter(active ? null : domain.id)}
                      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium border transition-all ${active ? "bg-zinc-700 border-zinc-500 text-zinc-50" : "bg-zinc-800/50 border-zinc-700 text-zinc-400 hover:border-zinc-600 hover:text-zinc-200"}`}
                    >
                      <Icon className="w-3 h-3" />
                      {domain.name}
                    </button>
                  );
                })}
              </div>
              {/* Metric list */}
              {domainFilter && (
                <div className="space-y-1">
                  {filteredMetrics.length === 0 ? (
                    <p className="text-sm text-zinc-500 text-center py-4">No chartable metrics in this domain.</p>
                  ) : (
                    filteredMetrics.map((metric) => {
                      const isSelected = selectedMetrics.some((m) => m.metricId === metric.id);
                      const isDisabled = !isSelected && selectedMetrics.length >= 2;
                      return (
                        <button
                          key={metric.id}
                          disabled={isDisabled}
                          onClick={() => handleMetricToggle(metric.id, domainFilter)}
                          className={`w-full flex items-center justify-between p-3 rounded-xl transition-colors text-left ${isSelected ? "bg-zinc-700 border border-zinc-600" : isDisabled ? "opacity-40 cursor-not-allowed" : "hover:bg-zinc-800"}`}
                        >
                          <div>
                            <p className="text-sm font-medium text-zinc-200">{metric.name}</p>
                            <p className="text-xs text-zinc-500 mt-0.5">{metric.description}</p>
                          </div>
                          <div className="flex items-center gap-2 shrink-0 ml-3">
                            <span className="text-xs text-zinc-600">{metric.unitLabel}</span>
                            {isSelected && <Check className="w-4 h-4 text-emerald-400" />}
                          </div>
                        </button>
                      );
                    })
                  )}
                </div>
              )}
              {!domainFilter && (
                <p className="text-sm text-zinc-500 text-center py-6">Select a domain above to browse metrics</p>
              )}
            </div>
          )}

          {/* Step 2: Chart type */}
          {step === "chart_type" && (
            <div className="grid grid-cols-3 gap-3">
              {CHART_TYPES.map(({ type, label, desc, Icon }) => (
                <button
                  key={type}
                  onClick={() => setChartType(type)}
                  className={`flex flex-col items-center gap-2 p-4 rounded-xl border transition-all ${chartType === type ? "bg-zinc-700 border-zinc-500" : "bg-zinc-800/50 border-zinc-700 hover:border-zinc-600"}`}
                >
                  <Icon className={`w-6 h-6 ${chartType === type ? "text-emerald-400" : "text-zinc-400"}`} />
                  <span className="text-sm font-medium text-zinc-200">{label}</span>
                  <span className="text-xs text-zinc-500">{desc}</span>
                </button>
              ))}
            </div>
          )}

          {/* Step 3: Time range */}
          {step === "time_range" && (
            <div className="flex gap-3">
              {([7, 30, 90] as const).map((d) => (
                <button
                  key={d}
                  onClick={() => setDays(d)}
                  className={`flex-1 py-3 rounded-xl border text-sm font-medium transition-all ${days === d ? "bg-zinc-700 border-zinc-500 text-zinc-50" : "bg-zinc-800/50 border-zinc-700 text-zinc-400 hover:border-zinc-600 hover:text-zinc-200"}`}
                >
                  {d}d
                </button>
              ))}
            </div>
          )}

          {/* Step 4: Preview */}
          {step === "preview" && (
            <div>
              {loadingPreview ? (
                <div className="h-48 flex items-center justify-center">
                  <p className="text-sm text-zinc-500">Loading preview…</p>
                </div>
              ) : (
                <GraphChart
                  metricIds={selectedMetrics.map((m) => m.metricId)}
                  domainIds={selectedMetrics.map((m) => m.domain)}
                  seriesData={seriesData}
                  chartType={chartType}
                  days={days}
                  height={220}
                />
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-5 py-4 border-t border-zinc-800 shrink-0">
          <span className="text-xs text-zinc-600">{stepIndex + 1} / {stepOrder.length}</span>
          {step === "preview" ? (
            <button
              onClick={handleSave}
              disabled={selectedMetrics.length === 0}
              className="px-4 py-2 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-zinc-950 text-sm font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Save chart
            </button>
          ) : (
            <button
              onClick={goNext}
              disabled={step === "metrics" && selectedMetrics.length === 0}
              className="px-4 py-2 rounded-lg bg-zinc-700 hover:bg-zinc-600 text-zinc-50 text-sm font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Next →
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
