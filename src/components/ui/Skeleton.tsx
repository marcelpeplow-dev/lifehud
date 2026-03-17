import { cn } from "@/lib/utils/cn";

export function Skeleton({ className }: { className?: string }) {
  return (
    <div className={cn("animate-pulse rounded-md bg-zinc-800", className)} />
  );
}

export function SkeletonCard({ className }: { className?: string }) {
  return (
    <div className={cn("bg-zinc-900 border border-zinc-800 rounded-xl p-5", className)}>
      <Skeleton className="h-3 w-24 mb-3" />
      <Skeleton className="h-7 w-20 mb-2" />
      <Skeleton className="h-3 w-16" />
    </div>
  );
}

export function SkeletonChart({ height = 180 }: { height?: number }) {
  const heightCls =
    height === 220 ? "h-[220px]" : height === 240 ? "h-[240px]" : "h-[180px]";
  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5">
      <Skeleton className="h-4 w-32 mb-1" />
      <Skeleton className="h-3 w-48 mb-4" />
      <Skeleton className={`w-full rounded-lg ${heightCls}`} />
    </div>
  );
}

export function SkeletonInsightCard() {
  return (
    <div className="bg-zinc-900 border border-zinc-800 border-l-2 border-l-zinc-700 rounded-xl p-5">
      <div className="flex items-center gap-2 mb-3">
        <Skeleton className="h-5 w-16 rounded-full" />
        <Skeleton className="h-3 w-20" />
      </div>
      <Skeleton className="h-4 w-3/4 mb-2" />
      <Skeleton className="h-3 w-full mb-1" />
      <Skeleton className="h-3 w-5/6" />
    </div>
  );
}
