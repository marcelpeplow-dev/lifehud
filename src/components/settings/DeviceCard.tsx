"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Wifi, WifiOff } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { formatRelativeDate } from "@/lib/utils/dates";
import type { DeviceConnection } from "@/types/index";

const PROVIDER_LABELS: Record<DeviceConnection["provider"], string> = {
  FITBIT: "Fitbit",
  APPLE: "Apple Watch",
  GARMIN: "Garmin",
  OURA: "Oura Ring",
  WHOOP: "Whoop",
};

export function DeviceCard({ device }: { device: DeviceConnection }) {
  const router = useRouter();
  const [disconnecting, setDisconnecting] = useState(false);

  async function disconnect() {
    if (!confirm(`Disconnect ${PROVIDER_LABELS[device.provider]}?`)) return;
    setDisconnecting(true);
    const supabase = createClient();
    await supabase
      .from("device_connections")
      .update({ is_active: false })
      .eq("id", device.id);
    router.refresh();
  }

  return (
    <div className="flex items-center justify-between gap-4 p-4 bg-zinc-800/50 rounded-xl">
      <div className="flex items-center gap-3">
        <div className="w-9 h-9 rounded-lg bg-zinc-700 flex items-center justify-center">
          <Wifi className="w-4 h-4 text-blue-400" />
        </div>
        <div>
          <p className="text-sm font-medium text-zinc-50">{PROVIDER_LABELS[device.provider]}</p>
          <p className="text-xs text-zinc-500 mt-0.5">
            {device.last_sync_at
              ? `Last sync ${formatRelativeDate(device.last_sync_at.slice(0, 10))}`
              : `Connected ${formatRelativeDate(device.connected_at.slice(0, 10))}`}
          </p>
        </div>
      </div>
      <button
        onClick={disconnect}
        disabled={disconnecting}
        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-zinc-400 hover:text-red-400 hover:bg-red-500/10 transition-colors disabled:opacity-40"
      >
        <WifiOff className="w-3.5 h-3.5" />
        {disconnecting ? "Disconnecting…" : "Disconnect"}
      </button>
    </div>
  );
}
