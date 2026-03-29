"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Archive } from "lucide-react";

export function ArchiveGoalButton({ goalId }: { goalId: string }) {
  const router = useRouter();
  const [showModal, setShowModal] = useState(false);
  const [loading, setLoading] = useState(false);

  async function archive() {
    setLoading(true);
    await fetch(`/api/goals/${goalId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ is_active: false }),
    });
    setShowModal(false);
    router.refresh();
    setLoading(false);
  }

  return (
    <>
      <button
        onClick={() => setShowModal(true)}
        className="p-1.5 rounded-md text-zinc-600 hover:text-zinc-400 hover:bg-zinc-800 transition-colors"
        title="Archive goal"
      >
        <Archive className="w-4 h-4" />
      </button>

      {showModal && (
        <div className="fixed inset-0 bg-zinc-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="w-full max-w-sm bg-zinc-900 border border-zinc-800 rounded-xl p-6 space-y-4">
            <h2 className="text-base font-semibold text-zinc-50">Archive this goal?</h2>
            <p className="text-sm text-zinc-400">
              This goal will be moved to your archive and removed from your active goals list.
            </p>
            <div className="flex gap-3 pt-1">
              <button
                onClick={() => setShowModal(false)}
                className="flex-1 py-2 rounded-lg bg-zinc-700 hover:bg-zinc-600 text-sm font-medium text-zinc-200 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={archive}
                disabled={loading}
                className="flex-1 py-2 rounded-lg bg-blue-500 hover:bg-blue-400 disabled:opacity-50 text-sm font-medium text-zinc-950 transition-colors"
              >
                {loading ? "Archiving…" : "Archive"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
