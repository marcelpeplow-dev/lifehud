"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Home,
  Moon,
  Dumbbell,
  Sparkles,
  Swords,
  Target,
  ClipboardList,
} from "lucide-react";

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
  { label: "Chess", href: "/dashboard/chess", icon: Swords },
  { label: "Insights", href: "/dashboard/insights", icon: Sparkles },
  { label: "Goals", href: "/dashboard/goals", icon: Target },
  { label: "Daily", href: "/dashboard/daily-input", icon: ClipboardList },
];

export function MobileNav() {
  const pathname = usePathname();

  function isActive(href: string, exact?: boolean) {
    if (exact) return pathname === href;
    return pathname.startsWith(href);
  }

  return (
    <nav className="md:hidden fixed bottom-0 left-0 right-0 z-50 bg-zinc-900 border-t border-zinc-800">
      <div className="flex items-center justify-around h-16 px-2 safe-area-pb">
        {NAV_ITEMS.map(({ label, href, icon: Icon, exact }) => {
          const active = isActive(href, exact);
          return (
            <Link
              key={href}
              href={href}
              className="flex flex-col items-center gap-1 px-3 py-2 rounded-lg min-w-0 flex-1"
            >
              <Icon
                className={`w-5 h-5 shrink-0 transition-colors ${
                  active ? "text-emerald-400" : "text-zinc-500"
                }`}
              />
              <span
                className={`text-xs font-medium truncate transition-colors ${
                  active ? "text-zinc-50" : "text-zinc-500"
                }`}
              >
                {label}
              </span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
