"use client";

import { useState } from "react";
import { Plus, Loader2 } from "lucide-react";

export function ConnectDeviceButton() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function connect() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/terra/auth", { method: "POST" });
      const data = await res.json();
      if (!res.ok || !data.url) throw new Error(data.error ?? "Could not get widget URL");
      window.open(data.url, "_blank", "noopener,noreferrer");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to open widget");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div>
      <button
        onClick={connect}
        disabled={loading}
        className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-sm font-medium transition-colors disabled:opacity-50"
      >
        {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
        Add device
      </button>
      {error && <p className="text-xs text-red-400 mt-2">{error}</p>}
    </div>
  );
}
