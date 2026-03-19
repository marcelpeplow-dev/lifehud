"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  Activity,
  Home,
  Moon,
  Dumbbell,
  Sparkles,
  Target,
  SmilePlus,
  Settings,
  LogOut,
  Upload,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";

interface NavItem {
  label: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  exact?: boolean;
}

const NAV_ITEMS: NavItem[] = [
  { label: "Overview", href: "/dashboard", icon: Home, exact: true },
  { label: "Sleep", href: "/dashboard/sleep", icon: Moon },
  { label: "Fitness", href: "/dashboard/fitness", icon: Dumbbell },
  { label: "Check-ins", href: "/dashboard/checkins", icon: SmilePlus },
  { label: "Insights", href: "/dashboard/insights", icon: Sparkles },
  { label: "Goals", href: "/dashboard/goals", icon: Target },
];

export function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();

  function isActive(href: string, exact?: boolean) {
    if (exact) return pathname === href;
    return pathname.startsWith(href);
  }

  async function handleSignOut() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  }

  return (
    <aside className="hidden md:flex flex-col w-60 shrink-0 bg-zinc-900 border-r border-zinc-800 h-screen sticky top-0">
      {/* Brand */}
      <div className="flex items-center gap-2.5 px-5 h-16 border-b border-zinc-800">
        <div className="w-7 h-7 rounded-md bg-emerald-500 flex items-center justify-center shrink-0">
          <Activity className="w-3.5 h-3.5 text-zinc-950" strokeWidth={2.5} />
        </div>
        <span className="font-semibold text-zinc-50 tracking-tight">
          Life HUD
        </span>
      </div>

      {/* Main nav */}
      <nav className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto">
        {NAV_ITEMS.map(({ label, href, icon: Icon, exact }) => {
          const active = isActive(href, exact);
          return (
            <Link
              key={href}
              href={href}
              className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors group ${
                active
                  ? "bg-zinc-800 text-zinc-50"
                  : "text-zinc-400 hover:text-zinc-50 hover:bg-zinc-800/60"
              }`}
            >
              <Icon
                className={`w-4 h-4 shrink-0 transition-colors ${
                  active
                    ? "text-emerald-400"
                    : "text-zinc-500 group-hover:text-zinc-300"
                }`}
              />
              {label}
            </Link>
          );
        })}
      </nav>

      {/* Bottom section */}
      <div className="px-3 py-4 border-t border-zinc-800 space-y-0.5">
        <Link
          href="/dashboard/import"
          className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors group ${
            isActive("/dashboard/import")
              ? "bg-zinc-800 text-zinc-50"
              : "text-zinc-400 hover:text-zinc-50 hover:bg-zinc-800/60"
          }`}
        >
          <Upload
            className={`w-4 h-4 shrink-0 transition-colors ${
              isActive("/dashboard/import")
                ? "text-emerald-400"
                : "text-zinc-500 group-hover:text-zinc-300"
            }`}
          />
          Import data
        </Link>
        <Link
          href="/dashboard/settings"
          className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors group ${
            isActive("/dashboard/settings")
              ? "bg-zinc-800 text-zinc-50"
              : "text-zinc-400 hover:text-zinc-50 hover:bg-zinc-800/60"
          }`}
        >
          <Settings
            className={`w-4 h-4 shrink-0 transition-colors ${
              isActive("/dashboard/settings")
                ? "text-emerald-400"
                : "text-zinc-500 group-hover:text-zinc-300"
            }`}
          />
          Settings
        </Link>

        <button
          onClick={handleSignOut}
          className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium text-zinc-400 hover:text-zinc-50 hover:bg-zinc-800/60 transition-colors group"
        >
          <LogOut className="w-4 h-4 shrink-0 text-zinc-500 group-hover:text-zinc-300 transition-colors" />
          Sign out
        </button>
      </div>
    </aside>
  );
}
