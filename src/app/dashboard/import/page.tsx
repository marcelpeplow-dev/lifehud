import { Upload } from "lucide-react";
import { ImportFlow } from "@/components/import/ImportFlow";

export default function ImportPage() {
  return (
    <div className="space-y-6">
      <div>
        <div className="flex items-center gap-2.5 mb-1">
          <Upload className="w-5 h-5 text-zinc-500" />
          <h1 className="text-2xl font-semibold text-zinc-50 tracking-tight">Import data</h1>
        </div>
        <p className="text-sm text-zinc-400">
          Import from Garmin, Fitbit, or Apple Health (via QS Access) to populate sleep, workouts, and daily metrics.
        </p>
      </div>

      <ImportFlow />
    </div>
  );
}
