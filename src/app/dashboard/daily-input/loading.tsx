import { Skeleton } from "@/components/ui/Skeleton";

export default function DailyInputLoading() {
  return (
    <div className="max-w-lg space-y-5">
      {/* Page header */}
      <div className="flex items-center gap-3">
        <Skeleton className="w-9 h-9 rounded-xl shrink-0" />
        <div>
          <Skeleton className="h-6 w-28 mb-1.5" />
          <Skeleton className="h-3 w-36" />
        </div>
      </div>

      {/* Domain section */}
      {Array.from({ length: 3 }).map((_, i) => (
        <div key={i} className="bg-zinc-900 border border-zinc-800 rounded-xl p-5 space-y-4">
          {/* Domain header */}
          <div className="flex items-center gap-2">
            <Skeleton className="w-5 h-5 rounded" />
            <Skeleton className="h-4 w-24" />
          </div>
          {/* Metric rows */}
          {Array.from({ length: 2 + (i % 2) }).map((_, j) => (
            <div key={j} className="space-y-2">
              <div className="flex items-center justify-between">
                <Skeleton className="h-3 w-32" />
                <Skeleton className="h-3 w-12" />
              </div>
              <Skeleton className="h-2 w-full rounded-full" />
            </div>
          ))}
        </div>
      ))}

      {/* Submit button */}
      <Skeleton className="h-11 w-full rounded-xl" />
    </div>
  );
}
