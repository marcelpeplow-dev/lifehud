"use client";

import { useState } from "react";
import { Plus } from "lucide-react";
import { AddGoalModal } from "./AddGoalModal";

export function AddGoalButton() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-blue-500 hover:bg-blue-400 text-zinc-950 text-sm font-semibold transition-colors"
      >
        <Plus className="w-4 h-4" />
        Add goal
      </button>
      {open && <AddGoalModal onClose={() => setOpen(false)} />}
    </>
  );
}
