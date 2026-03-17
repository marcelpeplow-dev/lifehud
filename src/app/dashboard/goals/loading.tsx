import { Skeleton } from "@/components/ui/Skeleton";

function SkeletonGoalCard() {
  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5">
      <div className="flex items-start justify-between gap-3 mb-4">
        <div className="flex items-center gap-2.5">
          <Skeleton className="h-6 w-16 rounded-md" />
          <Skeleton className="h-4 w-32" />
        </div>
        <Skeleton className="h-7 w-7 rounded-md" />
      </div>
      <div className="mb-2">
        <div className="flex justify-between mb-1.5">
          <Skeleton className="h-3 w-28" />
          <Skeleton className="h-3 w-8" />
        </div>
        <Skeleton className="h-2 w-full rounded-full" />
      </div>
      <div className="flex justify-between mt-3">
        <Skeleton className="h-3 w-24" />
        <Skeleton className="h-3 w-20" />
      </div>
    </div>
  );
}

export default function GoalsLoading() {
  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <Skeleton className="h-7 w-16 mb-2" />
          <Skeleton className="h-4 w-48" />
        </div>
        <Skeleton className="h-9 w-28 rounded-lg" />
      </div>
      <div>
        <Skeleton className="h-3 w-20 mb-3" />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {Array.from({ length: 4 }).map((_, i) => <SkeletonGoalCard key={i} />)}
        </div>
      </div>
    </div>
  );
}
