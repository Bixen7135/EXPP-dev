"use client";

import Link from "next/link";
import type { ReactNode } from "react";

export interface ResolvedDashboardNavItem {
  href: string;
  label: string;
  icon: ReactNode;
  active: boolean;
}

interface DashboardNavigationItemProps {
  item: ResolvedDashboardNavItem;
  onNavigate?: () => void;
}

export function DashboardNavigationItem({
  item,
  onNavigate,
}: DashboardNavigationItemProps) {
  return (
    <div className="relative">
      <Link
        href={item.href}
        onClick={onNavigate}
        className={`group flex h-9 w-full items-center rounded px-3 text-left transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--color-blue-400)] ${
          item.active
            ? "bg-slate-800/70 text-slate-100"
            : "text-slate-300 hover:bg-slate-800/55 hover:text-slate-100"
        }`}
      >
        <span
          className={`inline-flex items-center justify-center ${
            item.active ? "text-slate-300" : "text-slate-500 group-hover:text-slate-300"
          }`}
        >
          {item.icon}
        </span>
        <span
          className={`ml-2 text-sm leading-none ${
            item.active ? "font-semibold" : "font-medium"
          }`}
        >
          {item.label}
        </span>
      </Link>
    </div>
  );
}
