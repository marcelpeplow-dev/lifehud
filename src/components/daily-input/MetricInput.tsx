"use client";

import type { MetricDefinition } from "@/lib/metrics/registry";

interface Props {
  metric: MetricDefinition;
  value: number | undefined;
  textValue?: string;
  onChange: (metricId: string, value: number) => void;
  onTextChange?: (metricId: string, value: string) => void;
}

function decimalToTime(decimal: number): string {
  const h = Math.floor(decimal) % 24;
  const m = Math.round((decimal % 1) * 60);
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

function timeToDecimal(time: string): number {
  const [h, m] = time.split(":").map(Number);
  return (h ?? 0) + (m ?? 0) / 60;
}

export function MetricInput({ metric, value, textValue, onChange, onTextChange }: Props) {
  const cfg = metric.inputConfig ?? {};
  const min = cfg.min ?? 0;
  const max = cfg.max ?? 100;
  const step = cfg.step ?? 1;
  const current = value ?? min;

  if (metric.inputType === "slider") {
    return (
      <div className="flex items-center gap-3">
        <input
          type="range"
          min={min} max={max} step={step}
          value={current}
          onChange={(e) => onChange(metric.id, Number(e.target.value))}
          className="flex-1 h-1.5 appearance-none rounded-full bg-zinc-700 accent-emerald-500 cursor-pointer"
        />
        <span className="text-sm font-semibold text-zinc-100 w-8 text-right tabular-nums">
          {Math.round(current)}
        </span>
      </div>
    );
  }

  if (metric.inputType === "stepper") {
    return (
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => onChange(metric.id, Math.max(min, current - step))}
          className="w-8 h-8 rounded-lg bg-zinc-800 text-zinc-300 hover:bg-zinc-700 flex items-center justify-center text-lg leading-none"
        >−</button>
        <span className="text-sm font-semibold text-zinc-100 w-8 text-center tabular-nums">
          {Math.round(current)}
        </span>
        <button
          type="button"
          onClick={() => onChange(metric.id, Math.min(max, current + step))}
          className="w-8 h-8 rounded-lg bg-zinc-800 text-zinc-300 hover:bg-zinc-700 flex items-center justify-center text-lg leading-none"
        >+</button>
        {metric.unitLabel !== "—" && (
          <span className="text-xs text-zinc-500 ml-1">{metric.unitLabel}</span>
        )}
      </div>
    );
  }

  if (metric.inputType === "toggle") {
    const on = current === 1;
    return (
      <button
        type="button"
        role="switch"
        aria-checked={on}
        onClick={() => onChange(metric.id, on ? 0 : 1)}
        className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors ${
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

  if (metric.inputType === "time") {
    const timeStr = value != null ? decimalToTime(value) : "";
    return (
      <input
        type="time"
        value={timeStr}
        onChange={(e) => {
          if (e.target.value) onChange(metric.id, timeToDecimal(e.target.value));
        }}
        className="bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-1.5 text-sm text-zinc-100 focus:outline-none focus:border-emerald-500 [color-scheme:dark]"
      />
    );
  }

  if (metric.inputType === "text") {
    return (
      <textarea
        value={textValue ?? ""}
        onChange={(e) => onTextChange?.(metric.id, e.target.value)}
        placeholder={cfg.placeholder ?? ""}
        rows={2}
        className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-zinc-100 placeholder-zinc-600 focus:outline-none focus:border-emerald-500 resize-none"
      />
    );
  }

  // number input (default)
  return (
    <div className="flex items-center gap-2">
      <input
        type="number"
        min={min} max={max} step={step}
        value={current || ""}
        placeholder={cfg.placeholder ?? "0"}
        onChange={(e) => onChange(metric.id, Number(e.target.value))}
        className="w-28 bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-1.5 text-sm text-zinc-100 focus:outline-none focus:border-emerald-500 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
      />
      {metric.unitLabel !== "—" && (
        <span className="text-xs text-zinc-500">{metric.unitLabel}</span>
      )}
    </div>
  );
}
