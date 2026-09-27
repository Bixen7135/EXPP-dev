"use client";

import { ExppBrand } from "@/lib/ui/expp-brand";
import { CloseIcon } from "./navigation";
import {
  DashboardNavigationItem,
  type ResolvedDashboardNavItem,
} from "./DashboardNavigationItem";

interface DashboardSidebarProps {
  homeHref: string;
  navigation: ResolvedDashboardNavItem[];
  open?: boolean;
  onClose?: () => void;
  mobile?: boolean;
}

export function DashboardSidebar({
  homeHref,
  navigation,
  open = true,
  onClose,
  mobile = false,
}: DashboardSidebarProps) {
  const content = (
    <>
      {mobile ? (
        <div className="h-14 px-3">
          <div className="flex h-full items-center justify-between">
            <ExppBrand href={homeHref} variant="header" />
            <button
              type="button"
              aria-label="Close sidebar"
              onClick={onClose}
              className="inline-flex h-7 w-7 items-center justify-center rounded text-slate-400 transition-colors hover:bg-slate-800/60 hover:text-slate-200 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--color-blue-400)]"
            >
              <CloseIcon />
            </button>
          </div>
        </div>
      ) : null}

      <div className="px-2 pt-4">
        <nav className="space-y-1" aria-label="Dashboard navigation">
          {navigation.map((item) => (
            <DashboardNavigationItem
              key={item.href}
              item={item}
              onNavigate={mobile ? onClose : undefined}
            />
          ))}
        </nav>
        <div className="mt-4 border-b border-slate-800" />
      </div>
    </>
  );

  if (mobile) {
    return (
      <aside
        className={`absolute left-0 top-0 z-20 h-full w-[280px] overflow-hidden border-r border-slate-700 bg-slate-950 transition-transform duration-200 ease-out lg:hidden ${
          open ? "translate-x-0" : "-translate-x-full"
        }`}
        aria-hidden={!open}
      >
        {content}
      </aside>
    );
  }

  return (
    <aside className="hidden w-[260px] shrink-0 border-r border-slate-800 lg:block">
      {content}
    </aside>
  );
}
