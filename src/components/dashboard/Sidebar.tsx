"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Activity, Home, Moon, Dumbbell, Crown,
  Sparkles, Target, ClipboardList, Settings,
} from "lucide-react";
import { DOMAIN_REGISTRY } from "@/lib/metrics/domains";

const DOMAIN_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  moon: Moon, dumbbell: Dumbbell, crown: Crown, heart: Activity,
  activity: Activity, coffee: Activity, droplets: Activity,
  pill: Activity, monitor: Activity, wine: Activity,
};

// Only show these 3 domains in nav for now (others visible on settings)
const NAV_DOMAINS = ["sleep", "fitness", "chess"];

const DOMAIN_TEXT_COLORS: Record<string, string> = {
  "blue-400": "text-blue-400", "green-400": "text-green-400",
  "amber-400": "text-amber-400", "rose-400": "text-rose-400",
  "emerald-400": "text-emerald-400", "orange-400": "text-orange-400",
  "cyan-400": "text-cyan-400", "purple-400": "text-purple-400",
  "indigo-400": "text-indigo-400", "red-400": "text-red-400",
};

export function Sidebar() {
  const pathname = usePathname();

  function isActive(href: string, exact?: boolean) {
    if (exact) return pathname === href;
    return pathname.startsWith(href);
  }

  function navLink(href: string, Icon: React.ComponentType<{ className?: string }>, label: string, exact?: boolean, iconColorClass?: string) {
    const active = isActive(href, exact);
    return (
      <Link
        key={href}
        href={href}
        className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors group ${
          active ? "bg-zinc-800 text-zinc-50" : "text-zinc-400 hover:text-zinc-50 hover:bg-zinc-800/60"
        }`}
      >
        <Icon
          className={`w-4 h-4 shrink-0 transition-colors ${
            active
              ? (iconColorClass ?? "text-blue-400")
              : "text-zinc-500 group-hover:text-zinc-300"
          }`}
        />
        {label}
      </Link>
    );
  }

  const sectionLabel = (text: string) => (
    <p className="px-3 pt-4 pb-1 text-[10px] font-semibold text-zinc-600 uppercase tracking-widest">
      {text}
    </p>
  );

  return (
    <aside className="hidden md:flex flex-col w-60 shrink-0 bg-zinc-900 border-r border-zinc-800 h-screen sticky top-0">
      {/* Brand */}
      <div className="flex items-center gap-2.5 px-5 h-16 border-b border-zinc-800">
        <div className="w-7 h-7 rounded-md bg-blue-500 flex items-center justify-center shrink-0">
          <Activity className="w-3.5 h-3.5 text-zinc-950" strokeWidth={2.5} />
        </div>
        <span className="font-semibold text-zinc-50 tracking-tight">Life HUD</span>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 py-2 overflow-y-auto">
        {sectionLabel("Overview")}
        {navLink("/dashboard", Home, "Overview", true)}

        {sectionLabel("Domains")}
        {DOMAIN_REGISTRY.filter((d) => NAV_DOMAINS.includes(d.id)).map((domain) => {
          const Icon = DOMAIN_ICONS[domain.icon] ?? Activity;
          const active = isActive(`/dashboard/${domain.id}`);
          const iconColor = DOMAIN_TEXT_COLORS[domain.color] ?? "text-zinc-400";
          return (
            <Link
              key={domain.id}
              href={`/dashboard/${domain.id}`}
              className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors group ${
                active ? "bg-zinc-800 text-zinc-50" : "text-zinc-400 hover:text-zinc-50 hover:bg-zinc-800/60"
              }`}
            >
              <Icon className={`w-4 h-4 shrink-0 transition-colors ${active ? iconColor : "text-zinc-500 group-hover:text-zinc-300"}`} />
              {domain.name}
            </Link>
          );
        })}

        {sectionLabel("Tools")}
        {navLink("/dashboard/daily-input", ClipboardList, "Daily Input")}
        {navLink("/dashboard/insights", Sparkles, "Insights")}
        {navLink("/dashboard/goals", Target, "Goals")}

        {sectionLabel("System")}
        {navLink("/dashboard/settings", Settings, "Settings")}
      </nav>
    </aside>
  );
}
