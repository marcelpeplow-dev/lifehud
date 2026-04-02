"use client";

import { useState } from "react";
import { Loader2 } from "lucide-react";

export function ConnectWhoopButton() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function connect() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/whoop/auth", { method: "POST" });
      const data = await res.json();
      if (!res.ok || !data.url) throw new Error(data.error ?? "Could not start Whoop auth");
      window.location.href = data.url;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to connect Whoop");
      setLoading(false);
    }
  }

  return (
    <div>
      <button
        onClick={connect}
        disabled={loading}
        className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg bg-[#FF3D00] hover:bg-[#E03600] text-white text-sm font-semibold transition-colors disabled:opacity-50"
      >
        {loading ? (
          <Loader2 className="w-4 h-4 animate-spin" />
        ) : (
          // Whoop "W" lettermark icon
          <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
            <path d="M2 6l4 12 3-8 3 8 3-8 3 8 4-12h-3l-1.5 4.5L16 6l-3 8-1-2.5L10 6 7.5 10.5 6 6z" />
          </svg>
        )}
        Connect Whoop
      </button>
      {error && <p className="text-xs text-red-400 mt-2">{error}</p>}
    </div>
  );
}
