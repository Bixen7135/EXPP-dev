"use client";

import type { ReactNode } from "react";
import { DashboardLayout } from "@/components/dashboard/DashboardLayout";
import type { DashboardAccountOption } from "@/components/dashboard/DashboardUserMenu";

interface DashboardShellProps {
  username: string;
  avatarUrl: string | null;
  activeAccountId: string;
  availableAccounts: DashboardAccountOption[];
  children: ReactNode;
}

export function DashboardShell({
  username,
  avatarUrl,
  activeAccountId,
  availableAccounts,
  children,
}: DashboardShellProps) {
  return (
    <DashboardLayout
      role="global"
      username={username}
      avatarUrl={avatarUrl}
      activeAccountId={activeAccountId}
      availableAccounts={availableAccounts}
    >
      {children}
    </DashboardLayout>
  );
}
