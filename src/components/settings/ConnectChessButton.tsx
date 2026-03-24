"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";

export function ConnectChessButton() {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function connect() {
    const trimmed = username.trim();
    if (!trimmed) {
      setError("Please enter your Chess.com username");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      // Step 1: Verify and connect
      const res = await fetch("/api/chess/connect", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: trimmed }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Connection failed");

      // Step 2: Trigger initial sync
      fetch("/api/chess/sync", { method: "POST" }).catch(() => {
        // Fire-and-forget — sync runs in the background
      });

      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to connect");
      setLoading(false);
    }
  }

  return (
    <div className="space-y-3">
      <p className="text-sm text-zinc-500">
        Connect your Chess.com account to track ratings, game performance, and discover
        correlations between chess and your health data.
      </p>
      <div className="flex items-center gap-2">
        <input
          type="text"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && connect()}
          placeholder="Chess.com username"
          disabled={loading}
          className="flex-1 px-3 py-2 rounded-lg bg-zinc-800 border border-zinc-700 text-sm text-zinc-100 placeholder:text-zinc-500 focus:outline-none focus:ring-1 focus:ring-cyan-500/50 focus:border-cyan-500/50 disabled:opacity-50"
        />
        <button
          onClick={connect}
          disabled={loading || !username.trim()}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white text-sm font-semibold transition-colors disabled:opacity-50"
        >
          {loading && <Loader2 className="w-4 h-4 animate-spin" />}
          Connect
        </button>
      </div>
      {error && <p className="text-xs text-red-400">{error}</p>}
    </div>
  );
}
