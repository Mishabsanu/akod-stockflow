"use client";

import { LayoutGrid } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { findActiveModule, type NavModule } from "./navigation";

/** Thumb-reach tab bar on phones and tablets: first four modules + "More" (opens the menu). */
export function MobileBottomNav({ modules, onOpenMenu }: { modules: NavModule[]; onOpenMenu: () => void }) {
  const pathname = usePathname() || "";
  const activeId = findActiveModule(modules, pathname)?.id;
  const tabs = modules.slice(0, 4);

  return (
    <nav
      aria-label="Quick navigation"
      className="lg:hidden print:hidden fixed bottom-0 inset-x-0 z-40 bg-white border-t border-line shadow-[0_-4px_16px_-8px_rgba(15,23,42,0.15)] pb-[env(safe-area-inset-bottom)]"
    >
      <div className="grid grid-cols-5 h-16">
        {tabs.map((mod) => {
          const Icon = mod.icon;
          const active = mod.id === activeId;
          return (
            <Link
              key={mod.id}
              href={mod.items[0].href}
              className={`flex flex-col items-center justify-center gap-1 text-[10.5px] font-semibold relative ${
                active ? "text-brand" : "text-slate-500 hover:text-slate-800"
              }`}
            >
              {active && <span className="absolute top-0 left-1/2 -translate-x-1/2 w-8 h-0.5 rounded-b bg-brand" />}
              <Icon className="w-5 h-5" />
              <span className="truncate max-w-full px-1">{mod.label}</span>
            </Link>
          );
        })}
        <button
          type="button"
          onClick={onOpenMenu}
          className="flex flex-col items-center justify-center gap-1 text-[10.5px] font-semibold text-slate-500 hover:text-slate-800"
        >
          <LayoutGrid className="w-5 h-5" />
          <span>More</span>
        </button>
      </div>
    </nav>
  );
}
