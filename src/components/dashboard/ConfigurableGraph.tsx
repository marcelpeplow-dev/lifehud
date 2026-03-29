"use client";

import { useState, useEffect, useCallback } from "react";
import { BarChart2, Settings, X } from "lucide-react";
import { GraphBuilderModal } from "./GraphBuilderModal";
import { GraphChart } from "./GraphChart";
import type { GraphConfig } from "./GraphBuilderModal";
import type { SeriesPoint } from "@/lib/metrics/fetch-series";
import { getMetricById } from "@/lib/metrics/registry";

interface ConfigurableGraphProps {
  position: number;
  domain?: string | null;
  initialConfig?: GraphConfig | null;
  configType?: string;
  defaultDomain?: string;
}

export function ConfigurableGraph({ position, domain = null, initialConfig = null, configType = "graph", defaultDomain }: ConfigurableGraphProps) {
  const [config, setConfig] = useState<GraphConfig | null>(initialConfig);
  const [days, setDays] = useState<7 | 30 | 90>(initialConfig?.days ?? 30);
  const [seriesData, setSeriesData] = useState<Record<string, SeriesPoint[]>>({});
  const [loading, setLoading] = useState(false);
  const [showBuilder, setShowBuilder] = useState(false);

  const fetchSeries = useCallback(async (cfg: GraphConfig, d: 7 | 30 | 90) => {
    if (cfg.metrics.length === 0) return;
    setLoading(true);
    try {
      const results = await Promise.all(
        cfg.metrics.map((m) =>
          fetch(`/api/metric-series?metricId=${m.metricId}&days=${d}`)
            .then((r) => r.json() as Promise<{ series: SeriesPoint[] }>)
            .then((data) => ({ metricId: m.metricId, series: data.series ?? [] }))
        )
      );
      const map: Record<string, SeriesPoint[]> = {};
      for (const r of results) map[r.metricId] = r.series;
      setSeriesData(map);
    } catch { /* silent */ } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (config) fetchSeries(config, days);
  }, [config, days, fetchSeries]);

  async function handleRemove() {
    setConfig(null);
    setSeriesData({});
    await fetch("/api/dashboard-config", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ config_type: configType, position, domain: domain ?? null }),
    });
  }

  function handleSave(newConfig: GraphConfig) {
    setConfig(newConfig);
    setDays(newConfig.days);
    setShowBuilder(false);
  }

  if (!config) {
    return (
      <>
        <button
          onClick={() => setShowBuilder(true)}
          className="bg-zinc-900 border-2 border-dashed border-zinc-700 rounded-xl p-8 flex flex-col items-center justify-center gap-3 min-h-[200px] w-full hover:border-zinc-500 hover:bg-zinc-800/50 transition-all group"
        >
          <div className="flex items-center gap-2 text-zinc-600 group-hover:text-zinc-400 transition-colors">
            <BarChart2 className="w-6 h-6" />
            <span className="text-2xl font-light">+</span>
          </div>
          <span className="text-sm text-zinc-600 group-hover:text-zinc-400 transition-colors">Add chart</span>
        </button>
        {showBuilder && (
          <GraphBuilderModal
            position={position}
            onSave={handleSave}
            onClose={() => setShowBuilder(false)}
            configType={configType}
            pageDomain={domain}
            defaultDomain={defaultDomain}
          />
        )}
      </>
    );
  }

  const metricIds = config.metrics.map((m) => m.metricId);
  const domainIds = config.metrics.map((m) => m.domain);
  const title = metricIds.map((id) => getMetricById(id)?.shortName ?? id).join(" · ");

  return (
    <>
      <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5">
        {/* Card header */}
        <div className="flex items-center justify-between mb-4">
          <p className="text-sm font-medium text-zinc-200 truncate">{title}</p>
          <div className="flex items-center gap-1 shrink-0 ml-2">
            {/* Time range toggle */}
            <div className="flex items-center gap-0.5 bg-zinc-800 rounded-lg p-0.5 mr-2">
              {([7, 30, 90] as const).map((d) => (
                <button
                  key={d}
                  onClick={() => setDays(d)}
                  className={`px-2 py-0.5 rounded-md text-xs font-medium transition-colors ${days === d ? "bg-zinc-600 text-zinc-50" : "text-zinc-500 hover:text-zinc-300"}`}
                >
                  {d}d
                </button>
              ))}
            </div>
            <button
              onClick={() => setShowBuilder(true)}
              className="p-1.5 rounded-lg text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800 transition-colors"
              title="Edit chart"
            >
              <Settings className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={handleRemove}
              className="p-1.5 rounded-lg text-zinc-600 hover:text-red-400 hover:bg-zinc-800 transition-colors"
              title="Remove chart"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Chart */}
        {loading ? (
          <div className="h-48 flex items-center justify-center">
            <p className="text-sm text-zinc-600">Loading…</p>
          </div>
        ) : (
          <div className="outline-none [&_svg]:outline-none [&_*:focus]:outline-none">
          <GraphChart
            metricIds={metricIds}
            domainIds={domainIds}
            seriesData={seriesData}
            chartType={config.chartType}
            days={days}
            height={200}
          />
          </div>
        )}
      </div>

      {showBuilder && (
        <GraphBuilderModal
          position={position}
          initialConfig={config}
          onSave={handleSave}
          onClose={() => setShowBuilder(false)}
        />
      )}
    </>
  );
}
