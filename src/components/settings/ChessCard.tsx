"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { RefreshCw, Loader2, Unplug } from "lucide-react";
import { formatDistanceToNow, parseISO } from "date-fns";

interface ChessConnection {
  username: string;
  avatar: string | null;
  lastSync: string | null;
  rapid: number | null;
  blitz: number | null;
  bullet: number | null;
}

export function ChessCard({ connection }: { connection: ChessConnection }) {
  const router = useRouter();
  const [syncing, setSyncing] = useState(false);
  const [disconnecting, setDisconnecting] = useState(false);
  const [syncMessage, setSyncMessage] = useState<string | null>(null);

  async function syncNow() {
    setSyncing(true);
    setSyncMessage(null);
    try {
      const res = await fetch("/api/chess/sync", { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Sync failed");
      setSyncMessage(data.summary);
      router.refresh();
    } catch (e) {
      setSyncMessage(e instanceof Error ? e.message : "Sync failed");
    } finally {
      setSyncing(false);
    }
  }

  async function disconnect() {
    if (!confirm("Disconnect Chess.com? Your existing game data will be kept.")) return;
    setDisconnecting(true);
    try {
      await fetch("/api/chess/connect", { method: "DELETE" });
      router.refresh();
    } catch {
      setDisconnecting(false);
    }
  }

  const lastSyncText = connection.lastSync
    ? `Synced ${formatDistanceToNow(parseISO(connection.lastSync), { addSuffix: true })}`
    : "Not yet synced";

  const ratings = [
    connection.rapid && `Rapid ${connection.rapid}`,
    connection.blitz && `Blitz ${connection.blitz}`,
    connection.bullet && `Bullet ${connection.bullet}`,
  ].filter(Boolean);

  return (
    <div className="p-4 bg-zinc-800/50 rounded-xl space-y-3">
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          {connection.avatar ? (
            <img
              src={connection.avatar}
              alt={connection.username}
              className="w-9 h-9 rounded-lg object-cover"
            />
          ) : (
            <div className="w-9 h-9 rounded-lg bg-cyan-500/15 flex items-center justify-center">
              <ChessKnightIcon className="w-4 h-4 text-cyan-400" />
            </div>
          )}
          <div>
            <p className="text-sm font-medium text-zinc-50">{connection.username}</p>
            <p className="text-xs text-zinc-500 mt-0.5">{lastSyncText}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={syncNow}
            disabled={syncing}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-zinc-300 hover:text-emerald-400 hover:bg-emerald-500/10 transition-colors disabled:opacity-40"
          >
            {syncing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
            {syncing ? "Syncing..." : "Sync now"}
          </button>
          <button
            onClick={disconnect}
            disabled={disconnecting}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-zinc-400 hover:text-red-400 hover:bg-red-500/10 transition-colors disabled:opacity-40"
          >
            <Unplug className="w-3.5 h-3.5" />
            {disconnecting ? "Disconnecting..." : "Disconnect"}
          </button>
        </div>
      </div>

      {ratings.length > 0 && (
        <div className="flex items-center gap-3">
          {ratings.map((r) => (
            <span key={r} className="text-xs text-zinc-400 bg-zinc-700/50 px-2 py-0.5 rounded">
              {r}
            </span>
          ))}
        </div>
      )}

      {syncMessage && (
        <p className={`text-xs ${syncMessage.startsWith("Synced") || syncMessage.startsWith("No new") ? "text-emerald-400" : "text-red-400"}`}>
          {syncMessage}
        </p>
      )}
    </div>
  );
}

function ChessKnightIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
      <path d="M19 22H5v-2h14v2zm-3-4H8l.6-2.2C6.8 14.6 5.5 12.4 5.5 10c0-3.6 2.4-6.5 5.5-7.7V2c0-.6.4-1 1-1s1 .4 1 1v.3c.5.1 1 .3 1.5.5l-1.5 1.8c-.3-.1-.7-.1-1-.1C9.5 4.5 7.5 7 7.5 10c0 2.1 1.2 3.9 3 4.8L11 16h2l.5-1.2c1.8-.9 3-2.7 3-4.8 0-1-.3-2-.8-2.8l1.5-1.8c.8 1.2 1.3 2.8 1.3 4.6 0 2.4-1.3 4.6-3.1 5.8L16 18z" />
    </svg>
  );
}
