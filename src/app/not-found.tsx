import Link from "next/link";
import { Activity } from "lucide-react";

export default function NotFound() {
  return (
    <div className="min-h-screen bg-zinc-950 flex items-center justify-center px-4">
      <div className="text-center">
        <div className="w-12 h-12 rounded-xl bg-zinc-800 flex items-center justify-center mx-auto mb-6">
          <Activity className="w-6 h-6 text-zinc-600" />
        </div>
        <p className="text-6xl font-semibold text-zinc-700 mb-4 tabular-nums">404</p>
        <h1 className="text-lg font-semibold text-zinc-50 mb-2">Page not found</h1>
        <p className="text-sm text-zinc-400 mb-8">
          This page doesn&apos;t exist or has been moved.
        </p>
        <Link
          href="/dashboard"
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg bg-blue-500 hover:bg-blue-400 text-zinc-950 text-sm font-semibold transition-colors"
        >
          Go to dashboard
        </Link>
      </div>
    </div>
  );
}
