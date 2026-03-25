"use client";

import { ArrowLeft, ArrowRight, Moon, Dumbbell, Crown, Heart, Activity, Coffee, Droplets, Pill, Monitor, Wine } from "lucide-react";
import { DOMAIN_REGISTRY } from "@/lib/metrics/domains";

export interface DomainsData {
  selectedDomains: string[];
}

interface Props {
  data: DomainsData;
  onChange: (data: DomainsData) => void;
  onNext: () => void;
  onBack: () => void;
}

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

export function StepGoals({ data, onChange, onNext, onBack }: Props) {
  function toggle(id: string) {
    const current = data.selectedDomains;
    const next = current.includes(id)
      ? current.filter((d) => d !== id)
      : [...current, id];
    onChange({ selectedDomains: next });
  }

  const canContinue = data.selectedDomains.length > 0;

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-xl font-semibold text-zinc-50 mb-1">What do you want to track?</h2>
        <p className="text-sm text-zinc-400">Select the areas of your life you want Life HUD to help with.</p>
      </div>

      <div className="grid grid-cols-2 gap-2">
        {DOMAIN_REGISTRY.map((domain) => {
          const Icon = DOMAIN_ICONS[domain.icon] ?? Activity;
          const iconColor = DOMAIN_TEXT_COLORS[domain.color] ?? "text-zinc-400";
          const iconBg = DOMAIN_BG_COLORS[domain.color] ?? "bg-zinc-700";
          const selected = data.selectedDomains.includes(domain.id);
          return (
            <button
              key={domain.id}
              type="button"
              onClick={() => toggle(domain.id)}
              className={`flex flex-col items-start gap-2 p-3 rounded-xl border text-left transition-colors ${
                selected
                  ? "border-blue-500/60 bg-blue-500/10"
                  : "border-zinc-700 bg-zinc-800/50 hover:border-zinc-600"
              }`}
            >
              <div className={`w-7 h-7 rounded-lg flex items-center justify-center ${iconBg}`}>
                <Icon className={`w-3.5 h-3.5 ${iconColor}`} />
              </div>
              <div>
                <p className="text-xs font-semibold text-zinc-50">{domain.name}</p>
                <p className="text-[10px] text-zinc-500 mt-0.5">
                  {domain.source === "automated" ? "Connect data source in Settings" : "Quick daily check-in"}
                </p>
              </div>
            </button>
          );
        })}
      </div>

      {!canContinue && (
        <p className="text-xs text-zinc-500 text-center">Select at least one domain to continue</p>
      )}

      <div className="flex gap-3">
        <button
          type="button"
          onClick={onBack}
          className="flex items-center gap-1.5 px-4 py-3 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-sm font-medium transition-colors"
        >
          <ArrowLeft className="w-4 h-4" /> Back
        </button>
        <button
          type="button"
          onClick={onNext}
          disabled={!canContinue}
          className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl bg-blue-500 hover:bg-blue-400 text-zinc-950 font-semibold transition-colors disabled:opacity-40"
        >
          Continue <ArrowRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
