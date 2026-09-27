"use client";

import { ExppBrand } from "@/lib/ui/expp-brand";
import { DashboardUserMenu, type DashboardAccountOption } from "./DashboardUserMenu";
import { MenuIcon } from "./navigation";

interface DashboardHeaderProps {
  homeHref: string;
  username: string;
  avatarUrl: string | null;
  profileHref: string;
  settingsHref: string;
  activeAccountId?: string;
  availableAccounts?: DashboardAccountOption[];
  onOpenSidebar: () => void;
}

export function DashboardHeader({
  homeHref,
  username,
  avatarUrl,
  profileHref,
  settingsHref,
  activeAccountId,
  availableAccounts,
  onOpenSidebar,
}: DashboardHeaderProps) {
  return (
    <header className="sticky top-0 z-30 h-14 border-b border-slate-800 bg-slate-950 px-4">
      <div className="flex h-full items-center justify-between">
        <div className="flex min-w-0 items-center gap-[12px]">
          <button
            type="button"
            aria-label="Open sidebar"
            onClick={onOpenSidebar}
            className="inline-flex h-8 w-8 items-center justify-center rounded border border-slate-700 text-slate-300 transition-colors hover:bg-slate-800/60 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--color-blue-400)] lg:hidden"
          >
            <MenuIcon />
          </button>
          <ExppBrand href={homeHref} variant="header" />
          <span className="hidden text-[14px] font-semibold leading-none text-slate-100 sm:inline">
            Dashboard
          </span>
        </div>

        <DashboardUserMenu
          username={username}
          avatarUrl={avatarUrl}
          profileHref={profileHref}
          settingsHref={settingsHref}
          activeAccountId={activeAccountId}
          availableAccounts={availableAccounts}
        />
      </div>
    </header>
  );
}
