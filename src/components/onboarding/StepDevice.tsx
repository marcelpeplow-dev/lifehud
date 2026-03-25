import { ArrowLeft, Watch, ChevronRight, Loader2 } from "lucide-react";

const PROVIDERS = [
  { name: "Fitbit", logo: "⌚" },
  { name: "Apple Watch", logo: "🍎" },
  { name: "Garmin", logo: "⌚" },
  { name: "Oura Ring", logo: "💍" },
  { name: "Whoop", logo: "📿" },
];

interface Props {
  onConnect: () => void;
  onSkip: () => void;
  onBack: () => void;
  connecting: boolean;
  error: string | null;
}

export function StepDevice({ onConnect, onSkip, onBack, connecting, error }: Props) {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold text-zinc-50 mb-1">Connect your wearable</h2>
        <p className="text-sm text-zinc-400">
          Life HUD syncs automatically once your device is connected. Supports:
        </p>
      </div>

      {/* Supported devices */}
      <div className="grid grid-cols-1 gap-2">
        {PROVIDERS.map((p) => (
          <div key={p.name} className="flex items-center gap-3 px-4 py-3 bg-zinc-800/50 rounded-xl">
            <span className="text-lg">{p.logo}</span>
            <span className="text-sm text-zinc-300">{p.name}</span>
          </div>
        ))}
      </div>

      {error && <p className="text-xs text-red-400">{error}</p>}

      {/* Connect button */}
      <button
        type="button"
        onClick={onConnect}
        disabled={connecting}
        className="w-full flex items-center justify-between px-5 py-4 rounded-xl bg-blue-500 hover:bg-blue-400 text-zinc-950 font-semibold transition-colors disabled:opacity-60"
      >
        <div className="flex items-center gap-2.5">
          {connecting ? (
            <Loader2 className="w-5 h-5 animate-spin" />
          ) : (
            <Watch className="w-5 h-5" />
          )}
          {connecting ? "Opening device connection…" : "Connect a device"}
        </div>
        <ChevronRight className="w-4 h-4" />
      </button>

      <div className="flex gap-3">
        <button
          type="button"
          onClick={onBack}
          className="flex items-center gap-1.5 px-4 py-3 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-sm font-medium transition-colors"
        >
          <ArrowLeft className="w-4 h-4" /> Back
        </button>
        <button
          type="button"
          onClick={onSkip}
          className="flex-1 py-3 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-sm font-medium transition-colors"
        >
          Skip for now
        </button>
      </div>
    </div>
  );
}
