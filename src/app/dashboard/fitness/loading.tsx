import { SkeletonCard, SkeletonChart, Skeleton } from "@/components/ui/Skeleton";

export default function FitnessLoading() {
  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <Skeleton className="h-7 w-20 mb-2" />
          <Skeleton className="h-4 w-52" />
        </div>
        <Skeleton className="h-9 w-32 rounded-lg" />
      </div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {Array.from({ length: 4 }).map((_, i) => <SkeletonCard key={i} />)}
      </div>
      <SkeletonChart height={220} />
      <div>
        <Skeleton className="h-3 w-28 mb-3" />
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl divide-y divide-zinc-800">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="p-5 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Skeleton className="h-7 w-20 rounded-md" />
                <div>
                  <Skeleton className="h-4 w-28 mb-1.5" />
                  <Skeleton className="h-3 w-36" />
                </div>
              </div>
              <div className="flex gap-5">
                {Array.from({ length: 2 }).map((_, j) => (
                  <div key={j} className="text-right">
                    <Skeleton className="h-4 w-12 mb-1" />
                    <Skeleton className="h-3 w-10" />
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
