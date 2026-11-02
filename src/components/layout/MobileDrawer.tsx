"use client";

import { X } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect } from "react";
import { initials } from "@/lib/format";
import { useSession } from "@/components/providers/SessionProvider";
import { BrandMark } from "./BrandMark";
import { findActiveItem, findActiveModule, type NavModule } from "./navigation";

/** Phone / tablet menu: every module with its pages, styled like the desktop rail. */
export function MobileDrawer({ modules, open, onClose }: { modules: NavModule[]; open: boolean; onClose: () => void }) {
  const pathname = usePathname() || "";
  const user = useSession();
  const activeModule = findActiveModule(modules, pathname);
  const activeItem = findActiveItem(activeModule, pathname);

  // Close on Escape and stop the page scrolling behind the open menu
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = overflow;
    };
  }, [open, onClose]);

  return (
    <div className={`lg:hidden fixed inset-0 z-[70] ${open ? "" : "pointer-events-none"}`} aria-hidden={!open}>
      <div
        onClick={onClose}
        className={`absolute inset-0 bg-slate-900/50 backdrop-blur-xs transition-opacity duration-200 ${
          open ? "opacity-100" : "opacity-0"
        }`}
      />
      <nav
        aria-label="Main menu"
        className={`absolute left-0 top-0 bottom-0 w-[86%] max-w-[320px] bg-rail text-slate-300 flex flex-col shadow-2xl transition-transform duration-200 ease-out ${
          open ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="h-[50px] px-4 flex items-center justify-between bg-rail-header border-b border-rail-border">
          <div className="flex items-center gap-2.5">
            <BrandMark inverted size="sm" />
            <span className="text-xs font-bold uppercase tracking-wider text-white">Commerce</span>
          </div>
          <button type="button" onClick={onClose} aria-label="Close menu" className="p-1.5 rounded-md hover:bg-rail-hover text-slate-300">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto no-scrollbar py-2">
          {modules.map((mod) => {
            const Icon = mod.icon;
            const isActiveModule = mod.id === activeModule?.id;
            return (
              <div key={mod.id} className="py-1">
                <div
                  className={`px-4 py-2 flex items-center gap-2.5 text-[11px] font-bold uppercase tracking-wider ${
                    isActiveModule ? "text-white" : "text-slate-400"
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  {mod.label}
                </div>
                {mod.items.map((item) => {
                  const active = isActiveModule && activeItem?.href === item.href;
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      onClick={onClose}
                      className={`ml-4 mr-3 pl-7 pr-3 py-2.5 rounded-lg flex items-center text-[13px] transition-colors ${
                        active ? "bg-rail-active text-white font-semibold" : "text-slate-300 hover:bg-rail-hover hover:text-white"
                      }`}
                    >
                      {item.label}
                    </Link>
                  );
                })}
              </div>
            );
          })}
        </div>

        <div className="px-4 py-3 border-t border-rail-border bg-rail-header flex items-center gap-3">
          <div className="w-9 h-9 rounded-full bg-rail-active border border-[#2b5175] text-white flex items-center justify-center text-xs font-bold uppercase">
            {initials(user.name)}
          </div>
          <div className="min-w-0">
            <p className="text-xs font-bold text-white truncate">{user.name}</p>
            <p className="text-[11px] text-slate-400 truncate">{user.roleName}</p>
          </div>
        </div>
      </nav>
    </div>
  );
}
