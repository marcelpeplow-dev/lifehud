"use client";

import { useState, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import {
  FileArchive,
  CheckCircle,
  Loader2,
  AlertCircle,
  Moon,
  Dumbbell,
  BarChart3,
  Trash2,
  ArrowLeft,
} from "lucide-react";
import { parseGarminZip, type GarminImportData } from "@/lib/garmin/parser";

type Step = "idle" | "parsing" | "preview" | "importing" | "done" | "error";

// ─── SUB-COMPONENTS ───────────────────────────────────────────────────────────

function DropZone({
  dragging,
  onDrop,
  onDragOver,
  onDragLeave,
  onClick,
}: {
  dragging: boolean;
  onDrop: (e: React.DragEvent) => void;
  onDragOver: (e: React.DragEvent) => void;
  onDragLeave: () => void;
  onClick: () => void;
}) {
  return (
    <div
      onDrop={onDrop}
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      onClick={onClick}
      className={`flex flex-col items-center justify-center gap-4 rounded-xl border-2 border-dashed p-14 cursor-pointer transition-colors ${
        dragging
          ? "border-blue-500 bg-blue-500/5"
          : "border-zinc-700 hover:border-zinc-500 hover:bg-zinc-800/40"
      }`}
    >
      <div className="w-14 h-14 rounded-2xl bg-zinc-800 flex items-center justify-center">
        <FileArchive className="w-7 h-7 text-zinc-400" />
      </div>
      <div className="text-center">
        <p className="text-sm font-medium text-zinc-200">
          Drop your Garmin export <span className="text-blue-400">.zip</span> here
        </p>
        <p className="text-xs text-zinc-500 mt-1">or click to browse</p>
      </div>
      <p className="text-xs text-zinc-600 text-center max-w-xs leading-relaxed">
        Export from Garmin Connect → Account → Data Management → Export Your Data.
        Imports the last 30 days only.
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
        <p className="text-xs text-zinc-500">{count} record{count !== 1 ? "s" : ""} found</p>
      </div>
      <span className={`text-2xl font-semibold tabular-nums ${count > 0 ? "text-zinc-50" : "text-zinc-600"}`}>
        {count}
      </span>
    </div>
  );
}

// ─── MAIN COMPONENT ───────────────────────────────────────────────────────────

export function GarminImport() {
  const router = useRouter();
  const [step, setStep] = useState<Step>("idle");
  const [dragging, setDragging] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<GarminImportData | null>(null);
  const [clearing, setClearing] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFile = useCallback(async (file: File) => {
    if (!file.name.toLowerCase().endsWith(".zip")) {
      setError("Please upload a .zip file (Garmin Connect export).");
      setStep("error");
      return;
    }
    setStep("parsing");
    setError(null);
    try {
      const parsed = await parseGarminZip(file);
      setData(parsed);
      setStep("preview");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to parse file.");
      setStep("error");
    }
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragging(false);
      const file = e.dataTransfer.files[0];
      if (file) handleFile(file);
    },
    [handleFile]
  );

  async function handleConfirm() {
    if (!data) return;
    setStep("importing");
    try {
      const res = await fetch("/api/import/confirm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
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

  // ── Render states ──────────────────────────────────────────────────────────

  if (step === "parsing") {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-3">
        <Loader2 className="w-8 h-8 text-blue-400 animate-spin" />
        <p className="text-sm text-zinc-400">Parsing your Garmin export…</p>
      </div>
    );
  }

  if (step === "importing") {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-3">
        <Loader2 className="w-8 h-8 text-blue-400 animate-spin" />
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

        {total === 0 ? (
          <p className="text-sm text-amber-400 bg-amber-500/10 border border-amber-500/20 rounded-xl px-4 py-3">
            No records found in the last 30 days. Check your export date range.
          </p>
        ) : null}

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
            className="flex-1 px-4 py-2.5 rounded-lg bg-blue-500 hover:bg-blue-400 disabled:opacity-40 disabled:cursor-not-allowed text-zinc-950 text-sm font-semibold transition-colors"
          >
            Import {total} record{total !== 1 ? "s" : ""}
          </button>
        </div>
      </div>
    );
  }

  // idle or error
  return (
    <div className="space-y-6 max-w-lg">
      <DropZone
        dragging={dragging}
        onDrop={handleDrop}
        onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onClick={() => inputRef.current?.click()}
      />
      <input
        ref={inputRef}
        type="file"
        accept=".zip"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) handleFile(f);
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
          Remove all seeded and imported data to start fresh before reimporting.
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
