"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { LogOut } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

export function SignOutButton() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function signOut() {
    setLoading(true);
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/login");
  }

  return (
    <button
      onClick={signOut}
      disabled={loading}
      className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg border border-zinc-700 text-zinc-300 text-sm font-medium hover:border-red-500/50 hover:text-red-400 hover:bg-red-500/5 transition-colors disabled:opacity-50"
    >
      <LogOut className="w-4 h-4" />
      {loading ? "Signing out…" : "Sign out"}
    </button>
  );
}
