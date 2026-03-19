import { SkeletonCard, SkeletonChart, Skeleton } from "@/components/ui/Skeleton";

export default function CheckInsLoading() {
  return (
    <div className="space-y-8">
      <div>
        <Skeleton className="h-7 w-36 mb-2" />
        <Skeleton className="h-4 w-52" />
      </div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {Array.from({ length: 4 }).map((_, i) => <SkeletonCard key={i} />)}
      </div>
      <SkeletonChart />
    </div>
  );
}
