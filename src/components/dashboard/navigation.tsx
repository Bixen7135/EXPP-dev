import type { ReactNode } from "react";

export type DashboardRole = "admin" | "teacher" | "student" | "global";

export interface DashboardNavItem {
  id: string;
  label: string;
  icon: ReactNode;
  routeByRole: Partial<Record<DashboardRole, string>>;
  allowedRoles: DashboardRole[];
  order: number;
  activePatterns?: Partial<Record<DashboardRole, string[]>>;
}

function ShellIcon({
  children,
}: {
  children: ReactNode;
}) {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" className="h-[16px] w-[16px]">
      {children}
    </svg>
  );
}

export function MenuIcon() {
  return (
    <ShellIcon>
      <path
        d="M4 7h16M4 12h16M4 17h16"
        fill="none"
        stroke="currentColor"
        strokeLinecap="round"
        strokeWidth="1.6"
      />
    </ShellIcon>
  );
}

export function CloseIcon() {
  return (
    <ShellIcon>
      <path
        d="M7 7l10 10M17 7 7 17"
        fill="none"
        stroke="currentColor"
        strokeLinecap="round"
        strokeWidth="1.8"
      />
    </ShellIcon>
  );
}

export function DashboardIcon() {
  return (
    <ShellIcon>
      <path
        d="M4 11.2 12 4.8l8 6.4v7.2c0 .9-.7 1.6-1.6 1.6H5.6c-.9 0-1.6-.7-1.6-1.6v-7.2z"
        fill="none"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.9"
      />
      <path
        d="M9.2 20v-6.6h5.6V20"
        fill="none"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.9"
      />
    </ShellIcon>
  );
}

export function MaterialsIcon() {
  return (
    <ShellIcon>
      <path
        d="M3.5 7.5a2 2 0 0 1 2-2h4l2 2h7a2 2 0 0 1 2 2v7a2 2 0 0 1-2 2h-13a2 2 0 0 1-2-2z"
        fill="none"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.9"
      />
    </ShellIcon>
  );
}

export function GenerateIcon() {
  return (
    <ShellIcon>
      <path
        d="m12 3 2.1 4.9L19 10l-4.9 2.1L12 17l-2.1-4.9L5 10l4.9-2.1L12 3z"
        fill="none"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.8"
      />
    </ShellIcon>
  );
}

export function AssignmentsIcon() {
  return (
    <ShellIcon>
      <path
        d="M8 6h8M8 12h8M8 18h6M6 4h12a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2z"
        fill="none"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.8"
      />
    </ShellIcon>
  );
}

export function BanksIcon() {
  return (
    <ShellIcon>
      <path
        d="M4 7.5h16M4 12h16M4 16.5h16M6 5h12a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2Z"
        fill="none"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.8"
      />
    </ShellIcon>
  );
}

export function AnalyticsIcon() {
  return (
    <ShellIcon>
      <path
        d="M6 19v-8M12 19V7M18 19v-5M4 19h16"
        fill="none"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.8"
      />
    </ShellIcon>
  );
}

export function UsersIcon() {
  return (
    <ShellIcon>
      <path
        d="M9.5 11a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7Zm-6 8c.8-3 3.1-4.6 6-4.6 1.2 0 2.3.3 3.2.8M16.8 10.2a2.8 2.8 0 1 0 0-5.6M15.5 14.4c2.5.3 4.2 1.7 5 4.6"
        fill="none"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.8"
      />
    </ShellIcon>
  );
}

export function AuditIcon() {
  return (
    <ShellIcon>
      <path
        d="M6 4h9l3 3v13H6zM14.5 4v4h4M8.8 12h6.4M8.8 16h4.8"
        fill="none"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.8"
      />
    </ShellIcon>
  );
}

export function ProfileIcon() {
  return (
    <ShellIcon>
      <path
        d="M12 12a4.2 4.2 0 1 0 0-8.4 4.2 4.2 0 0 0 0 8.4zM4 20a8 8 0 0 1 16 0"
        fill="none"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.8"
      />
    </ShellIcon>
  );
}

export function SettingsIcon() {
  return (
    <ShellIcon>
      <path
        d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 0 0 2.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 0 0 1.065 2.572c1.757.426 1.757 2.924 0 3.35a1.724 1.724 0 0 0-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 0 0-2.572 1.065c-.426 1.757-2.924 1.757-3.35 0a1.724 1.724 0 0 0-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 0 0-1.065-2.572c-1.757-.426-1.757-2.924 0-3.35a1.724 1.724 0 0 0 1.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.607 2.296.07 2.572-1.065Z"
        fill="none"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.8"
      />
      <path
        d="M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z"
        fill="none"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.8"
      />
    </ShellIcon>
  );
}

export function SignOutIcon() {
  return (
    <ShellIcon>
      <path
        d="M10 5H6a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h4M14 8l5 4-5 4M8 12h11"
        fill="none"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.8"
      />
    </ShellIcon>
  );
}

export function SwitchAccountIcon() {
  return (
    <ShellIcon>
      <path
        d="M4 7h13M13 4l4 3-4 3M20 17H7M11 14l-4 3 4 3"
        fill="none"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.8"
      />
    </ShellIcon>
  );
}

export function AddAccountIcon() {
  return (
    <ShellIcon>
      <circle
        cx="8"
        cy="7"
        r="3.2"
        fill="none"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.8"
      />
      <path
        d="M2 18.2a6.2 6.2 0 0 1 12.4 0M18.5 3.5v5M16 6h5"
        fill="none"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.8"
      />
    </ShellIcon>
  );
}

export const DASHBOARD_NAV_ITEMS: DashboardNavItem[] = [
  {
    id: "dashboard",
    label: "Dashboard",
    icon: <DashboardIcon />,
    routeByRole: {
      admin: "/admin/dashboard",
      teacher: "/teacher/dashboard",
      student: "/student/dashboard",
      global: "/dashboard",
    },
    allowedRoles: ["admin", "teacher", "student", "global"],
    order: 10,
  },
  {
    id: "materials",
    label: "Materials",
    icon: <MaterialsIcon />,
    routeByRole: { teacher: "/teacher/materials", global: "/dashboard/materials" },
    allowedRoles: ["teacher", "global"],
    order: 20,
  },
  {
    id: "generate",
    label: "Generate",
    icon: <GenerateIcon />,
    routeByRole: { teacher: "/teacher/generate", global: "/dashboard/generate" },
    allowedRoles: ["teacher", "global"],
    order: 30,
  },
  {
    id: "assignments",
    label: "Assignments",
    icon: <AssignmentsIcon />,
    routeByRole: {
      teacher: "/teacher/assignments",
      student: "/student/assignments",
      global: "/dashboard/assignments",
    },
    allowedRoles: ["teacher", "student", "global"],
    order: 40,
    activePatterns: {
      teacher: ["/teacher/assignments", "/teacher/distribution"],
      global: ["/dashboard/assignments", "/dashboard/distribution"],
    },
  },
  {
    id: "banks",
    label: "Banks",
    icon: <BanksIcon />,
    routeByRole: { global: "/dashboard/banks" },
    allowedRoles: ["global"],
    order: 50,
  },
  {
    id: "analytics",
    label: "Analytics",
    icon: <AnalyticsIcon />,
    routeByRole: { teacher: "/teacher/analytics", global: "/dashboard/analytics" },
    allowedRoles: ["teacher", "global"],
    order: 60,
  },
  {
    id: "my-assignments",
    label: "My Assignments",
    icon: <AssignmentsIcon />,
    routeByRole: { global: "/dashboard/my-assignments" },
    allowedRoles: ["global"],
    order: 70,
  },
  {
    id: "users",
    label: "Users",
    icon: <UsersIcon />,
    routeByRole: { admin: "/admin/users" },
    allowedRoles: ["admin"],
    order: 80,
  },
  {
    id: "audit",
    label: "Audit Log",
    icon: <AuditIcon />,
    routeByRole: { admin: "/admin/audit" },
    allowedRoles: ["admin"],
    order: 90,
  },
  {
    id: "profile",
    label: "Profile",
    icon: <ProfileIcon />,
    routeByRole: {
      admin: "/admin/profile",
      teacher: "/teacher/profile",
      student: "/student/profile",
      global: "/dashboard/profile",
    },
    allowedRoles: ["admin", "teacher", "global"],
    order: 100,
  },
  {
    id: "settings",
    label: "Settings",
    icon: <SettingsIcon />,
    routeByRole: {
      admin: "/admin/settings",
      teacher: "/teacher/settings",
      student: "/student/settings",
      global: "/dashboard/settings",
    },
    allowedRoles: ["admin", "teacher", "student", "global"],
    order: 110,
  },
];

export function getDashboardNavItems(role: DashboardRole): DashboardNavItem[] {
  return DASHBOARD_NAV_ITEMS.filter(
    (item) => item.allowedRoles.includes(role) && item.routeByRole[role]
  ).sort((a, b) => a.order - b.order);
}

export function getRoleHref(role: DashboardRole, id: string): string {
  const item = DASHBOARD_NAV_ITEMS.find((entry) => entry.id === id);
  return item?.routeByRole[role] ?? "/";
}
