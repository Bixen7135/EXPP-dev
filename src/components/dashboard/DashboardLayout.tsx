"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import { usePathname } from "next/navigation";
import { DashboardHeader } from "./DashboardHeader";
import { DashboardSidebar } from "./DashboardSidebar";
import {
  writeStoredAccountPath,
  type DashboardAccountOption,
} from "./DashboardUserMenu";
import {
  getDashboardNavItems,
  getRoleHref,
  type DashboardNavItem,
  type DashboardRole,
} from "./navigation";
import type { ResolvedDashboardNavItem } from "./DashboardNavigationItem";

const SHELL_FONT_STACK =
  '-apple-system, BlinkMacSystemFont, "Segoe UI", Helvetica, Arial, sans-serif';

interface DashboardLayoutProps {
  role: DashboardRole;
  username: string;
  avatarUrl: string | null;
  activeAccountId?: string;
  availableAccounts?: DashboardAccountOption[];
  children: ReactNode;
}

function isActivePath(
  pathname: string | null,
  role: DashboardRole,
  item: DashboardNavItem,
  href: string
): boolean {
  if (!pathname) return false;
  const patterns = item.activePatterns?.[role] ?? [href];
  return patterns.some((pattern) => {
    if (pathname === pattern) return true;
    if (item.id === "dashboard") return false;
    return pathname.startsWith(`${pattern}/`);
  });
}

export function DashboardLayout({
  role,
  username,
  avatarUrl,
  activeAccountId,
  availableAccounts,
  children,
}: DashboardLayoutProps) {
  const pathname = usePathname();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const homeHref = getRoleHref(role, "dashboard");
  const profileHref = "/dashboard/profile";
  const settingsHref = "/dashboard/settings";

  useEffect(() => {
    function handleEscape(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setSidebarOpen(false);
      }
    }

    document.addEventListener("keydown", handleEscape);
    return () => document.removeEventListener("keydown", handleEscape);
  }, []);

  useEffect(() => {
    if (!activeAccountId || !pathname) return;
    writeStoredAccountPath(activeAccountId, pathname);
  }, [activeAccountId, pathname]);

  const navigation = useMemo<ResolvedDashboardNavItem[]>(() => {
    return getDashboardNavItems(role)
      .filter((item) => item.id !== "profile" && item.id !== "settings")
      .map((item) => {
        const href = item.routeByRole[role] as string;
        return {
          href,
          label: item.label,
          icon: item.icon,
          active: isActivePath(pathname, role, item, href),
        };
      });
  }, [pathname, role]);

  const workspaceScope =
    role === "global" ? "dashboard-workspace-scope" : "role-workspace-scope";

  return (
    <div
      className="workspace-shell min-h-screen text-[color:var(--workspace-ink)]"
      style={{ fontFamily: SHELL_FONT_STACK }}
    >
      <a
        href="#dashboard-content"
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:rounded-md focus:bg-[color:var(--color-blue-600)] focus:px-4 focus:py-2 focus:text-sm focus:font-semibold focus:text-white"
      >
        Skip to content
      </a>
      <div className="relative min-h-screen overflow-x-hidden">
        <DashboardHeader
          homeHref={homeHref}
          username={username}
          avatarUrl={avatarUrl}
          profileHref={profileHref}
          settingsHref={settingsHref}
          activeAccountId={activeAccountId}
          availableAccounts={availableAccounts}
          onOpenSidebar={() => setSidebarOpen(true)}
        />

        <div className="flex min-h-[calc(100vh-60px)]">
          <DashboardSidebar homeHref={homeHref} navigation={navigation} />
          <section id="dashboard-content" className="min-w-0 flex-1 overflow-x-auto" tabIndex={-1}>
            <div className={workspaceScope}>{children}</div>
          </section>
        </div>

        {sidebarOpen ? (
          <button
            type="button"
            aria-label="Close sidebar overlay"
            className="absolute inset-0 z-10 bg-slate-950/55 lg:hidden"
            onClick={() => setSidebarOpen(false)}
          />
        ) : null}

        <DashboardSidebar
          homeHref={homeHref}
          navigation={navigation}
          open={sidebarOpen}
          onClose={() => setSidebarOpen(false)}
          mobile
        />
      </div>
    </div>
  );
}
