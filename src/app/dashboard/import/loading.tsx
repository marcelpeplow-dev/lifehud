import { Skeleton } from "@/components/ui/Skeleton";

export default function ImportLoading() {
  return (
    <div className="space-y-6">
      <div>
        <Skeleton className="h-7 w-40 mb-2" />
        <Skeleton className="h-4 w-72" />
      </div>
      <Skeleton className="h-64 w-full max-w-lg rounded-xl" />
    </div>
  );
}
