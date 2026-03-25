"use client";

import { useState, useEffect } from "react";
import { X, ChevronLeft } from "lucide-react";
import {
  Moon, Dumbbell, Crown, Heart, Activity,
  Coffee, Droplets, Pill, Monitor, Wine,
} from "lucide-react";
import { DOMAIN_REGISTRY } from "@/lib/metrics/domains";
import { getMetricsByDomain } from "@/lib/metrics/registry";
import type { DomainDefinition } from "@/lib/metrics/domains";
import type { MetricDefinition } from "@/lib/metrics/registry";

const DOMAIN_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  moon: Moon, dumbbell: Dumbbell, crown: Crown, heart: Heart,
  activity: Activity, coffee: Coffee, droplets: Droplets,
  pill: Pill, monitor: Monitor, wine: Wine,
};

const DOMAIN_TEXT_COLORS: Record<string, string> = {
  "blue-400": "text-blue-400", "green-400": "text-green-400",
  "amber-400": "text-amber-400", "rose-400": "text-rose-400",
  "emerald-400": "text-emerald-400", "orange-400": "text-orange-400",
  "cyan-400": "text-cyan-400", "purple-400": "text-purple-400",
  "indigo-400": "text-indigo-400", "red-400": "text-red-400",
};

const DOMAIN_BG_COLORS: Record<string, string> = {
  "blue-400": "bg-blue-500/10", "green-400": "bg-green-500/10",
  "amber-400": "bg-amber-500/10", "rose-400": "bg-rose-500/10",
  "emerald-400": "bg-emerald-500/10", "orange-400": "bg-orange-500/10",
  "cyan-400": "bg-cyan-500/10", "purple-400": "bg-purple-500/10",
  "indigo-400": "bg-indigo-500/10", "red-400": "bg-red-500/10",
};

interface MetricPickerModalProps {
  onSelect: (metricId: string, domainId: string) => void;
  onClose: () => void;
}

export function MetricPickerModal({ onSelect, onClose }: MetricPickerModalProps) {
  const [step, setStep] = useState<"domain" | "metric">("domain");
  const [selectedDomain, setSelectedDomain] = useState<DomainDefinition | null>(null);
  const [metrics, setMetrics] = useState<MetricDefinition[]>([]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  function handleDomainSelect(domain: DomainDefinition) {
    const domainMetrics = getMetricsByDomain(domain.id).filter(
      (m) => m.inputType !== "text"
    );
    setSelectedDomain(domain);
    setMetrics(domainMetrics);
    setStep("metric");
  }

  function handleMetricSelect(metric: MetricDefinition) {
    if (selectedDomain) {
      onSelect(metric.id, selectedDomain.id);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="w-full sm:max-w-md bg-zinc-900 border border-zinc-800 rounded-t-2xl sm:rounded-2xl max-h-[80vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-zinc-800 shrink-0">
          <div className="flex items-center gap-2">
            {step === "metric" && (
              <button
                onClick={() => setStep("domain")}
                className="p-1 rounded-lg text-zinc-400 hover:text-zinc-50 hover:bg-zinc-800 transition-colors"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
            )}
            <h2 className="text-sm font-semibold text-zinc-50">
              {step === "domain" ? "Choose a domain" : `${selectedDomain?.name} metrics`}
            </h2>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-zinc-400 hover:text-zinc-50 hover:bg-zinc-800 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content */}
        <div className="overflow-y-auto flex-1 p-4">
          {step === "domain" ? (
            <div className="grid grid-cols-2 gap-3">
              {DOMAIN_REGISTRY.map((domain) => {
                const Icon = DOMAIN_ICONS[domain.icon] ?? Activity;
                const iconColor = DOMAIN_TEXT_COLORS[domain.color] ?? "text-zinc-400";
                const bgColor = DOMAIN_BG_COLORS[domain.color] ?? "bg-zinc-800";
                return (
                  <button
                    key={domain.id}
                    onClick={() => handleDomainSelect(domain)}
                    className="flex items-center gap-3 p-3 rounded-xl bg-zinc-800/50 hover:bg-zinc-800 border border-zinc-700/50 hover:border-zinc-600 transition-all text-left"
                  >
                    <div className={`w-8 h-8 rounded-lg ${bgColor} flex items-center justify-center shrink-0`}>
                      <Icon className={`w-4 h-4 ${iconColor}`} />
                    </div>
                    <span className="text-sm font-medium text-zinc-200">{domain.name}</span>
                  </button>
                );
              })}
            </div>
          ) : (
            <div className="space-y-1">
              {metrics.length === 0 ? (
                <p className="text-sm text-zinc-500 text-center py-8">No metrics available for this domain.</p>
              ) : (
                metrics.map((metric) => (
                  <button
                    key={metric.id}
                    onClick={() => handleMetricSelect(metric)}
                    className="w-full flex items-center justify-between p-3 rounded-xl hover:bg-zinc-800 transition-colors text-left group"
                  >
                    <div>
                      <p className="text-sm font-medium text-zinc-200 group-hover:text-zinc-50">{metric.name}</p>
                      <p className="text-xs text-zinc-500 mt-0.5">{metric.description}</p>
                    </div>
                    <span className="text-xs text-zinc-600 shrink-0 ml-3">{metric.unitLabel}</span>
                  </button>
                ))
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
