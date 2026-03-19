import { Upload } from "lucide-react";
import { GarminImport } from "@/components/import/GarminImport";

export default function ImportPage() {
  return (
    <div className="space-y-6">
      <div>
        <div className="flex items-center gap-2.5 mb-1">
          <Upload className="w-5 h-5 text-zinc-500" />
          <h1 className="text-2xl font-semibold text-zinc-50 tracking-tight">Import data</h1>
        </div>
        <p className="text-sm text-zinc-400">
          Import your Garmin Connect export to populate sleep, workouts, and daily metrics.
        </p>
      </div>

      <GarminImport />
    </div>
  );
}
