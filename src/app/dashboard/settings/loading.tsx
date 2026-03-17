import { Skeleton } from "@/components/ui/Skeleton";

function SkeletonSection({ rows = 3 }: { rows?: number }) {
  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6">
      <Skeleton className="h-5 w-32 mb-1" />
      <Skeleton className="h-3 w-56 mb-5" />
      <div className="space-y-4">
        {Array.from({ length: rows }).map((_, i) => (
          <div key={i}>
            <Skeleton className="h-3 w-24 mb-1.5" />
            <Skeleton className="h-10 w-full rounded-lg" />
          </div>
        ))}
      </div>
    </div>
  );
}

export default function SettingsLoading() {
  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <Skeleton className="h-7 w-24 mb-2" />
        <Skeleton className="h-4 w-56" />
      </div>
      <SkeletonSection rows={4} />
      <SkeletonSection rows={2} />
      <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6">
        <Skeleton className="h-5 w-20 mb-5" />
        <div className="flex items-center justify-between">
          <div>
            <Skeleton className="h-4 w-40 mb-1.5" />
            <Skeleton className="h-3 w-28" />
          </div>
          <Skeleton className="h-9 w-24 rounded-lg" />
        </div>
      </div>
    </div>
  );
}
