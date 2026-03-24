"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Wifi, WifiOff, RefreshCw, Loader2 } from "lucide-react";
import { formatDistanceToNow, parseISO } from "date-fns";

interface FitbitIntegration {
  id: string;
  provider_user_id: string | null;
  last_sync_at: string | null;
  created_at: string;
}

export function FitbitCard({ integration }: { integration: FitbitIntegration }) {
  const router = useRouter();
  const [disconnecting, setDisconnecting] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [syncMessage, setSyncMessage] = useState<string | null>(null);

  async function disconnect() {
    if (!confirm("Disconnect Fitbit? Your existing data will be kept.")) return;
    setDisconnecting(true);
    await fetch("/api/fitbit/disconnect", { method: "POST" });
    router.refresh();
  }

  async function syncNow() {
    setSyncing(true);
    setSyncMessage(null);
    try {
      const res = await fetch("/api/fitbit/sync", { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Sync failed");
      setSyncMessage(`Synced: ${data.sleep ?? 0} sleep, ${data.workouts ?? 0} workouts, ${data.metrics ?? 0} metrics`);
      router.refresh();
    } catch (e) {
      setSyncMessage(e instanceof Error ? e.message : "Sync failed");
    } finally {
      setSyncing(false);
    }
  }

  const lastSync = integration.last_sync_at
    ? `Synced ${formatDistanceToNow(parseISO(integration.last_sync_at), { addSuffix: true })}`
    : `Connected ${formatDistanceToNow(parseISO(integration.created_at), { addSuffix: true })}`;

  return (
    <div className="p-4 bg-zinc-800/50 rounded-xl space-y-3">
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-[#00B0B9]/15 flex items-center justify-center">
            <Wifi className="w-4 h-4 text-[#00B0B9]" />
          </div>
          <div>
            <p className="text-sm font-medium text-zinc-50">Fitbit</p>
            <p className="text-xs text-zinc-500 mt-0.5">{lastSync}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={syncNow}
            disabled={syncing}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-zinc-300 hover:text-emerald-400 hover:bg-emerald-500/10 transition-colors disabled:opacity-40"
          >
            {syncing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
            {syncing ? "Syncing…" : "Sync now"}
          </button>
          <button
            onClick={disconnect}
            disabled={disconnecting}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-zinc-400 hover:text-red-400 hover:bg-red-500/10 transition-colors disabled:opacity-40"
          >
            <WifiOff className="w-3.5 h-3.5" />
            {disconnecting ? "Disconnecting…" : "Disconnect"}
          </button>
        </div>
      </div>

      {syncMessage && (
        <p className={`text-xs ${syncMessage.startsWith("Synced") ? "text-emerald-400" : "text-red-400"}`}>
          {syncMessage}
        </p>
      )}
    </div>
  );
}
