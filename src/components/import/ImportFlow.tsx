"use client";

import { useState, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import {
  Upload,
  FileArchive,
  FileText,
  CheckCircle,
  Loader2,
  AlertCircle,
  Moon,
  Dumbbell,
  BarChart3,
  Trash2,
  ArrowLeft,
} from "lucide-react";
import { parseGarminZip } from "@/lib/garmin/parser";
import { parseFitbitZip } from "@/lib/fitbit/parser";
import { parseAppleHealth } from "@/lib/apple-health/parser";
import type { DeviceImportData } from "@/types/index";

// ─── DEVICE CONFIG ─────────────────────────────────────────────────────────────

type DeviceType = "garmin" | "fitbit" | "apple_health";
type Step = "idle" | "parsing" | "preview" | "importing" | "done" | "error";

interface DeviceConfig {
  label: string;
  source: string;
  fileAccept: string;
  multiple: boolean;
  dropLabel: string;
  dropHint: string;
  instructions: string;
}

const DEVICE_CONFIG: Record<DeviceType, DeviceConfig> = {
  garmin: {
    label: "Garmin",
    source: "garmin_csv",
    fileAccept: ".zip",
    multiple: false,
    dropLabel: "Drop your Garmin export .zip here",
    dropHint: "or click to browse",
    instructions: "Garmin Connect → Account → Data Management → Export Your Data",
  },
  fitbit: {
    label: "Fitbit",
    source: "fitbit_csv",
    fileAccept: ".zip",
    multiple: false,
    dropLabel: "Drop your Fitbit export .zip here",
    dropHint: "or click to browse",
    instructions: "fitbit.com → Settings → Export Account Data",
  },
  apple_health: {
    label: "Apple Health",
    source: "apple_health_csv",
    fileAccept: ".csv",
    multiple: true,
    dropLabel: "Drop your Apple Health CSV files here",
    dropHint: "select all files at once",
    instructions: "QS Access app → select Sleep Analysis, Steps, Heart Rate, Workouts → Share → CSV",
  },
};

const DEVICES = (Object.keys(DEVICE_CONFIG) as DeviceType[]).map((type) => ({
  type,
  label: DEVICE_CONFIG[type].label,
}));

// ─── SUB-COMPONENTS ────────────────────────────────────────────────────────────

function DevicePicker({
  active,
  onChange,
}: {
  active: DeviceType;
  onChange: (d: DeviceType) => void;
}) {
  return (
    <div className="flex gap-1 p-1 bg-zinc-900 border border-zinc-800 rounded-xl">
      {DEVICES.map(({ type, label }) => (
        <button
          key={type}
          onClick={() => onChange(type)}
          className={`flex-1 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
            active === type
              ? "bg-zinc-700 text-zinc-50"
              : "text-zinc-500 hover:text-zinc-300"
          }`}
        >
          {label}
        </button>
      ))}
    </div>
  );
}

function DropZone({
  config,
  dragging,
  onDrop,
  onDragOver,
  onDragLeave,
  onClick,
}: {
  config: DeviceConfig;
  dragging: boolean;
  onDrop: (e: React.DragEvent) => void;
  onDragOver: (e: React.DragEvent) => void;
  onDragLeave: () => void;
  onClick: () => void;
}) {
  const Icon = config.multiple ? FileText : FileArchive;
  return (
    <div
      onDrop={onDrop}
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      onClick={onClick}
      className={`flex flex-col items-center justify-center gap-4 rounded-xl border-2 border-dashed p-12 cursor-pointer transition-colors ${
        dragging
          ? "border-emerald-500 bg-emerald-500/5"
          : "border-zinc-700 hover:border-zinc-500 hover:bg-zinc-800/40"
      }`}
    >
      <div className="w-14 h-14 rounded-2xl bg-zinc-800 flex items-center justify-center">
        <Icon className="w-7 h-7 text-zinc-400" />
      </div>
      <div className="text-center">
        <p className="text-sm font-medium text-zinc-200">
          {config.dropLabel.split(".zip").map((part, i) =>
            i === 0 ? (
              <span key={i}>
                {part}
                {config.fileAccept === ".zip" && (
                  <span className="text-emerald-400">.zip</span>
                )}
              </span>
            ) : (
              <span key={i}>{part}</span>
            )
          )}
        </p>
        <p className="text-xs text-zinc-500 mt-1">{config.dropHint}</p>
      </div>
      <p className="text-xs text-zinc-600 text-center max-w-xs leading-relaxed">
        {config.instructions}. Imports the last 30 days only.
      </p>
    </div>
  );
}

function PreviewRow({
  icon,
  label,
  count,
  color,
}: {
  icon: React.ReactNode;
  label: string;
  count: number;
  color: string;
}) {
  return (
    <div className="flex items-center gap-4 py-4">
      <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${color}`}>
        {icon}
      </div>
      <div className="flex-1">
        <p className="text-sm font-medium text-zinc-50">{label}</p>
        <p className="text-xs text-zinc-500">
          {count} record{count !== 1 ? "s" : ""} found
        </p>
      </div>
      <span
        className={`text-2xl font-semibold tabular-nums ${
          count > 0 ? "text-zinc-50" : "text-zinc-600"
        }`}
      >
        {count}
      </span>
    </div>
  );
}

// ─── MAIN COMPONENT ────────────────────────────────────────────────────────────

export function ImportFlow() {
  const router = useRouter();
  const [device, setDevice] = useState<DeviceType>("garmin");
  const [step, setStep] = useState<Step>("idle");
  const [dragging, setDragging] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<DeviceImportData | null>(null);
  const [clearing, setClearing] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const config = DEVICE_CONFIG[device];

  function handleDevice(d: DeviceType) {
    setDevice(d);
    setStep("idle");
    setError(null);
    setData(null);
  }

  const handleFiles = useCallback(
    async (files: File[]) => {
      if (files.length === 0) return;
      setStep("parsing");
      setError(null);
      try {
        let parsed: DeviceImportData;
        if (device === "garmin") {
          if (!files[0].name.toLowerCase().endsWith(".zip"))
            throw new Error("Please upload a .zip file (Garmin Connect export).");
          parsed = await parseGarminZip(files[0]);
        } else if (device === "fitbit") {
          if (!files[0].name.toLowerCase().endsWith(".zip"))
            throw new Error("Please upload a .zip file (Fitbit export).");
          parsed = await parseFitbitZip(files[0]);
        } else {
          const nonCsv = files.find((f) => !f.name.toLowerCase().endsWith(".csv"));
          if (nonCsv) throw new Error("Please select CSV files only.");
          parsed = await parseAppleHealth(files);
        }
        setData(parsed);
        setStep("preview");
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed to parse files.");
        setStep("error");
      }
    },
    [device]
  );

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragging(false);
      const files = Array.from(e.dataTransfer.files);
      handleFiles(files);
    },
    [handleFiles]
  );

  async function handleConfirm() {
    if (!data) return;
    setStep("importing");
    try {
      const res = await fetch("/api/import/confirm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...data, source: config.source }),
      });
      if (!res.ok) {
        const body = await res.json();
        throw new Error(body.error ?? "Import failed");
      }
      setStep("done");
      setTimeout(() => router.push("/dashboard"), 1800);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Import failed.");
      setStep("error");
    }
  }

  async function handleClear() {
    setClearing(true);
    await fetch("/api/import/clear", { method: "DELETE" });
    setClearing(false);
    router.refresh();
  }

  // ── Loading states ──────────────────────────────────────────────────────────

  if (step === "parsing") {
    return (
      <div className="space-y-6 max-w-lg">
        <DevicePicker active={device} onChange={handleDevice} />
        <div className="flex flex-col items-center justify-center py-20 gap-3">
          <Loader2 className="w-8 h-8 text-emerald-400 animate-spin" />
          <p className="text-sm text-zinc-400">Parsing your {config.label} export…</p>
        </div>
      </div>
    );
  }

  if (step === "importing") {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-3">
        <Loader2 className="w-8 h-8 text-emerald-400 animate-spin" />
        <p className="text-sm text-zinc-400">Importing data…</p>
      </div>
    );
  }

  if (step === "done") {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-3">
        <CheckCircle className="w-10 h-10 text-emerald-400" />
        <p className="text-base font-medium text-zinc-50">Import complete!</p>
        <p className="text-sm text-zinc-500">Redirecting to dashboard…</p>
      </div>
    );
  }

  if (step === "preview" && data) {
    const total = data.sleep.length + data.workouts.length + data.metrics.length;
    return (
      <div className="space-y-6 max-w-lg">
        <DevicePicker active={device} onChange={handleDevice} />
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl divide-y divide-zinc-800">
          <PreviewRow
            icon={<Moon className="w-5 h-5 text-blue-400" />}
            color="bg-blue-500/10"
            label="Nights of sleep"
            count={data.sleep.length}
          />
          <PreviewRow
            icon={<Dumbbell className="w-5 h-5 text-orange-400" />}
            color="bg-orange-500/10"
            label="Workouts"
            count={data.workouts.length}
          />
          <PreviewRow
            icon={<BarChart3 className="w-5 h-5 text-green-400" />}
            color="bg-green-500/10"
            label="Days of metrics"
            count={data.metrics.length}
          />
        </div>

        {total === 0 && (
          <p className="text-sm text-amber-400 bg-amber-500/10 border border-amber-500/20 rounded-xl px-4 py-3">
            No records found in the last 30 days. Check your export date range.
          </p>
        )}

        <div className="flex items-center gap-3">
          <button
            onClick={() => setStep("idle")}
            className="flex items-center gap-2 px-4 py-2.5 rounded-lg border border-zinc-700 text-zinc-300 hover:text-zinc-50 hover:border-zinc-500 text-sm font-medium transition-colors"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            Back
          </button>
          <button
            onClick={handleConfirm}
            disabled={total === 0}
            className="flex-1 px-4 py-2.5 rounded-lg bg-emerald-500 hover:bg-emerald-400 disabled:opacity-40 disabled:cursor-not-allowed text-zinc-950 text-sm font-semibold transition-colors"
          >
            Import {total} record{total !== 1 ? "s" : ""}
          </button>
        </div>
      </div>
    );
  }

  // ── Idle / error ────────────────────────────────────────────────────────────
  return (
    <div className="space-y-6 max-w-lg">
      <DevicePicker active={device} onChange={handleDevice} />

      <DropZone
        config={config}
        dragging={dragging}
        onDrop={handleDrop}
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onClick={() => inputRef.current?.click()}
      />
      <input
        ref={inputRef}
        type="file"
        accept={config.fileAccept}
        multiple={config.multiple}
        className="hidden"
        onChange={(e) => {
          const files = Array.from(e.target.files ?? []);
          if (files.length) handleFiles(files);
          e.target.value = "";
        }}
      />

      {error && (
        <div className="flex items-start gap-3 px-4 py-3 bg-red-950/50 border border-red-900 rounded-xl text-sm text-red-400">
          <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      )}

      {/* Clear data section */}
      <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5">
        <p className="text-sm font-medium text-zinc-300 mb-1">Clear existing data</p>
        <p className="text-xs text-zinc-500 mb-4">
          Remove all seeded and imported data to start fresh before re-importing.
        </p>
        <button
          onClick={handleClear}
          disabled={clearing}
          className="flex items-center gap-2 px-3 py-2 rounded-lg border border-zinc-700 hover:border-red-800 text-zinc-400 hover:text-red-400 text-sm font-medium transition-colors disabled:opacity-50"
        >
          {clearing ? (
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
          ) : (
            <Trash2 className="w-3.5 h-3.5" />
          )}
          {clearing ? "Clearing…" : "Clear all data"}
        </button>
      </div>
    </div>
  );
}
