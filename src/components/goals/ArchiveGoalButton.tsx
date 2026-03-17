"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Archive } from "lucide-react";

export function ArchiveGoalButton({ goalId }: { goalId: string }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function archive() {
    if (!confirm("Archive this goal?")) return;
    setLoading(true);
    await fetch(`/api/goals/${goalId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ is_active: false }),
    });
    router.refresh();
    setLoading(false);
  }

  return (
    <button
      onClick={archive}
      disabled={loading}
      className="p-1.5 rounded-md text-zinc-600 hover:text-zinc-400 hover:bg-zinc-800 transition-colors disabled:opacity-40"
      title="Archive goal"
    >
      <Archive className="w-4 h-4" />
    </button>
  );
}
