import { cn } from "@/lib/utils/cn";

interface CardProps {
  className?: string;
  children: React.ReactNode;
}

export function Card({ className, children }: CardProps) {
  return (
    <div
      className={cn(
        "bg-zinc-900 border border-zinc-800 rounded-xl p-5",
        className
      )}
    >
      {children}
    </div>
  );
}
