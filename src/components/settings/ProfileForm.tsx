"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

interface ProfileFormProps {
  userId: string;
  initial: {
    display_name: string | null;
    date_of_birth: string | null;
    height_cm: number | null;
    weight_kg: number | null;
    timezone: string;
  };
}

const inputCls =
  "w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2.5 text-sm text-zinc-50 placeholder-zinc-600 focus:outline-none focus:border-emerald-500 transition-colors";

export function ProfileForm({ userId, initial }: ProfileFormProps) {
  const [form, setForm] = useState({
    display_name: initial.display_name ?? "",
    date_of_birth: initial.date_of_birth ?? "",
    height_cm: initial.height_cm?.toString() ?? "",
    weight_kg: initial.weight_kg?.toString() ?? "",
    timezone: initial.timezone,
  });
  const [status, setStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");

  function set(field: keyof typeof form, value: string) {
    setForm((f) => ({ ...f, [field]: value }));
    if (status !== "idle") setStatus("idle");
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!form.display_name.trim()) return;
    setStatus("saving");
    const supabase = createClient();
    const { error } = await supabase
      .from("profiles")
      .update({
        display_name: form.display_name,
        date_of_birth: form.date_of_birth || null,
        height_cm: form.height_cm ? Number(form.height_cm) : null,
        weight_kg: form.weight_kg ? Number(form.weight_kg) : null,
        timezone: form.timezone,
      })
      .eq("id", userId);
    setStatus(error ? "error" : "saved");
  }

  return (
    <form onSubmit={save} className="space-y-4">
      <div>
        <label className="block text-xs font-medium text-zinc-400 mb-1.5">Display name *</label>
        <input
          type="text"
          value={form.display_name}
          onChange={(e) => set("display_name", e.target.value)}
          className={inputCls}
        />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-medium text-zinc-400 mb-1.5">Date of birth</label>
          <input
            type="date"
            value={form.date_of_birth}
            onChange={(e) => set("date_of_birth", e.target.value)}
            className={inputCls}
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-zinc-400 mb-1.5">Timezone</label>
          <input
            type="text"
            value={form.timezone}
            onChange={(e) => set("timezone", e.target.value)}
            className={inputCls}
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-medium text-zinc-400 mb-1.5">Height (cm)</label>
          <input
            type="number"
            value={form.height_cm}
            onChange={(e) => set("height_cm", e.target.value)}
            min="100" max="250"
            className={inputCls}
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-zinc-400 mb-1.5">Weight (kg)</label>
          <input
            type="number"
            value={form.weight_kg}
            onChange={(e) => set("weight_kg", e.target.value)}
            min="30" max="300"
            className={inputCls}
          />
        </div>
      </div>

      <div className="flex items-center gap-3 pt-1">
        <button
          type="submit"
          disabled={status === "saving" || !form.display_name.trim()}
          className="px-4 py-2 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-zinc-950 text-sm font-semibold transition-colors disabled:opacity-50"
        >
          {status === "saving" ? "Saving…" : "Save changes"}
        </button>
        {status === "saved" && <p className="text-xs text-emerald-400">Saved</p>}
        {status === "error" && <p className="text-xs text-red-400">Failed to save</p>}
      </div>
    </form>
  );
}
