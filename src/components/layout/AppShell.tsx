"use client";

import { useCallback, useState, type ReactNode } from "react";
import type { SessionUser } from "@/lib/types";
import { SessionProvider } from "@/components/providers/SessionProvider";
import { LeftSidebar } from "./LeftSidebar";
import { MobileBottomNav } from "./MobileBottomNav";
import { MobileDrawer } from "./MobileDrawer";
import { TopHeader } from "./TopHeader";
import { visibleModules } from "./navigation";

/**
 * Desktop (lg+): fixed 88px rail + 128px three-tier header, as in Proserve.
 * Phone / tablet: 88px header (brand bar + sub-tabs), slide-in menu and a bottom tab bar.
 */
export function AppShell({ user, children }: { user: SessionUser; children: ReactNode }) {
  const modules = visibleModules(user);
  const [menuOpen, setMenuOpen] = useState(false);
  const openMenu = useCallback(() => setMenuOpen(true), []);
  const closeMenu = useCallback(() => setMenuOpen(false), []);

  return (
    <SessionProvider user={user}>
      <div className="min-h-screen flex flex-col bg-canvas text-slate-900">
        <TopHeader modules={modules} onOpenMenu={openMenu} />
        <div className="flex flex-1 min-h-screen">
          <LeftSidebar modules={modules} />
          <main className="flex-1 lg:ml-[88px] mt-[88px] lg:mt-[128px] px-3 pt-4 pb-24 sm:px-5 sm:pt-5 lg:p-7 print:m-0 print:p-0 w-full min-w-0 overflow-x-hidden">
            <div className="w-full max-w-[1600px] mx-auto space-y-4 lg:space-y-5">{children}</div>
          </main>
        </div>
        <MobileBottomNav modules={modules} onOpenMenu={openMenu} />
        <MobileDrawer modules={modules} open={menuOpen} onClose={closeMenu} />
      </div>
    </SessionProvider>
  );
}
