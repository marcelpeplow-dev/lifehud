"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { RefreshCw, Loader2, Unplug } from "lucide-react";
import { formatDistanceToNow, parseISO } from "date-fns";

interface LichessConnection {
  username: string;
  lastSync: string | null;
  rapid: number | null;
  blitz: number | null;
  bullet: number | null;
}

export function LichessCard({ connection }: { connection: LichessConnection }) {
  const router = useRouter();
  const [syncing, setSyncing] = useState(false);
  const [disconnecting, setDisconnecting] = useState(false);
  const [syncMessage, setSyncMessage] = useState<string | null>(null);

  async function syncNow() {
    setSyncing(true);
    setSyncMessage(null);
    try {
      const res = await fetch("/api/lichess/sync", { method: "POST" });
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
    if (!confirm("Disconnect Lichess? Your existing game data will be kept.")) return;
    setDisconnecting(true);
    try {
      await fetch("/api/lichess/connect", { method: "DELETE" });
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
          <div className="w-9 h-9 rounded-lg bg-zinc-100 flex items-center justify-center">
            <LichessIcon className="w-5 h-5 text-zinc-900" />
          </div>
          <div>
            <p className="text-sm font-medium text-zinc-50">{connection.username}</p>
            <p className="text-xs text-zinc-500 mt-0.5">{lastSyncText}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={syncNow}
            disabled={syncing}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-zinc-300 hover:text-blue-400 hover:bg-blue-500/10 transition-colors disabled:opacity-40"
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
        <p className={`text-xs ${syncMessage.startsWith("Synced") || syncMessage.startsWith("No new") ? "text-blue-400" : "text-red-400"}`}>
          {syncMessage}
        </p>
      )}
    </div>
  );
}

function LichessIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 50 50" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
      <path d="M38.956.904c-3.55-.418-6.245 2.127-8.282 4.869C28.637 8.514 13.69 32.6 8.907 38.26c-1.553 1.836-.157 4.652 2.109 4.413 3.275-.346 7.056-.456 7.44 2.654.212 1.718-.997 3.87-.997 3.87s8.273-1.79 12.135-3.645c3.863-1.854 9.17-5.276 12.353-10.391 3.183-5.115 5.034-12.133 3.372-18.37-1.49-5.59-4.685-10.706-4.685-10.706s3.14-2.49 1.63-4.15c-.602-.662-1.6-1.03-3.308-1.23z" />
    </svg>
  );
}
