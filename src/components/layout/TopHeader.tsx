"use client";

import { Bell, Menu, Search } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { BrandMark } from "./BrandMark";
import { findActiveItem, findActiveModule, type NavModule } from "./navigation";
import { UserMenu } from "./UserMenu";

/**
 * Desktop: three tiers as in Proserve — purple brand bar → module tabs → active module's sub-tabs.
 * Below lg the module tabs move into the slide-in menu, leaving brand bar + sub-tabs (88px).
 */
export function TopHeader({ modules, onOpenMenu }: { modules: NavModule[]; onOpenMenu: () => void }) {
  const pathname = usePathname() || "";
  const activeModule =
    findActiveModule(modules, pathname) ?? modules.find((m) => m.id === "home") ?? modules[0];
  const activeItem = findActiveItem(activeModule, pathname);

  return (
    <div className="fixed top-0 left-0 lg:left-[88px] right-0 z-40 select-none shadow-xs print:hidden">
      <header className="relative h-[50px] bg-brand text-white px-3 sm:px-4 lg:px-6 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2.5 min-w-0">
          <button
            type="button"
            onClick={onOpenMenu}
            aria-label="Open menu"
            className="lg:hidden p-1.5 -ml-1 rounded-md text-white/90 hover:text-white hover:bg-white/10"
          >
            <Menu className="w-5 h-5" />
          </button>
          <Link href="/dashboard" className="lg:hidden shrink-0" aria-label="AKOD Commerce home">
            <BrandMark inverted size="sm" />
          </Link>
          <span className="hidden sm:block text-xs font-bold uppercase tracking-wider truncate max-w-[280px]">
            <span className="lg:hidden">{activeModule?.label}</span>
            <span className="hidden lg:inline">AKOD Commerce</span>
          </span>
        </div>

        <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-md lg:max-w-xl px-4 hidden lg:block">
          <div className="relative flex items-center">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 pointer-events-none" />
            <input
              type="text"
              readOnly
              placeholder="Search modules and records"
              className="w-full pl-10 pr-4 py-1.5 bg-white text-xs text-slate-800 placeholder-slate-400 rounded-full border border-white/20 focus:outline-none"
            />
          </div>
        </div>

        <div className="flex items-center gap-3 shrink-0">
          <button type="button" title="Notifications" className="text-white/90 hover:text-white p-1">
            <Bell className="w-4 h-4" />
          </button>
          <UserMenu />
        </div>
      </header>

      <div className="hidden lg:flex bg-white border-b border-line px-6 items-center h-[40px]">
        <div className="flex items-center gap-8 overflow-x-auto no-scrollbar">
          {modules.map((mod) => {
            const active = mod.id === activeModule?.id;
            return (
              <Link
                key={mod.id}
                href={mod.items[0].href}
                className={`py-2.5 shrink-0 text-xs font-semibold uppercase tracking-wider relative ${
                  active ? "text-brand font-bold" : "text-slate-600 hover:text-slate-900"
                }`}
              >
                {mod.label}
                {active && (
                  <span className="absolute bottom-0 left-1/2 -translate-x-1/2 w-0 h-0 border-x-[5px] border-x-transparent border-b-[5px] border-b-brand" />
                )}
              </Link>
            );
          })}
        </div>
      </div>

      <div className="bg-white border-b border-line px-3 sm:px-4 lg:px-6 flex items-center h-[38px]">
        <div className="flex items-center gap-5 lg:gap-6 overflow-x-auto no-scrollbar">
          {activeModule?.items.map((item) => {
            const active = activeItem?.href === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`py-2 shrink-0 text-xs border-b-2 ${
                  active
                    ? "text-slate-900 font-semibold border-brand"
                    : "text-slate-500 hover:text-slate-900 border-transparent"
                }`}
              >
                {item.label}
              </Link>
            );
          })}
        </div>
      </div>
    </div>
  );
}
