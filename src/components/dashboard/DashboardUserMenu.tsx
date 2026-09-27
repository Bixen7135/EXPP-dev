"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { UserAvatar } from "@/lib/ui/user-avatar";
import {
  AddAccountIcon,
  ProfileIcon,
  SettingsIcon,
  SignOutIcon,
  SwitchAccountIcon,
} from "./navigation";

type AccountDomain = "GLOBAL" | "ORGANIZATION";

export interface DashboardAccountOption {
  id: string;
  domain: AccountDomain;
  displayName: string;
  avatarUrl: string | null;
  organizationId: string | null;
  organizationName: string | null;
}

interface DashboardUserMenuProps {
  username: string;
  avatarUrl: string | null;
  profileHref: string;
  settingsHref: string;
  activeAccountId?: string;
  availableAccounts?: DashboardAccountOption[];
}

const ACCOUNT_LAST_PATHS_STORAGE_KEY = "expp_account_last_paths_v1";
type AccountLastPathMap = Record<string, string>;

function isSafeInternalPath(path: string): boolean {
  return (
    path.startsWith("/") &&
    !path.startsWith("//") &&
    !path.startsWith("/api") &&
    !path.startsWith("/_next")
  );
}

function parseStoredAccountPaths(raw: string | null): AccountLastPathMap {
  if (!raw) return {};
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== "object") return {};

    const map: AccountLastPathMap = {};
    for (const [accountId, path] of Object.entries(parsed)) {
      if (typeof accountId === "string" && typeof path === "string" && isSafeInternalPath(path)) {
        map[accountId] = path;
      }
    }
    return map;
  } catch {
    return {};
  }
}

function readStoredAccountPath(accountId: string): string | null {
  if (typeof window === "undefined") return null;
  const map = parseStoredAccountPaths(window.localStorage.getItem(ACCOUNT_LAST_PATHS_STORAGE_KEY));
  return map[accountId] ?? null;
}

function writeStoredAccountPath(accountId: string, path: string): void {
  if (typeof window === "undefined") return;
  if (!accountId || !isSafeInternalPath(path)) return;

  const map = parseStoredAccountPaths(window.localStorage.getItem(ACCOUNT_LAST_PATHS_STORAGE_KEY));
  map[accountId] = path;
  window.localStorage.setItem(ACCOUNT_LAST_PATHS_STORAGE_KEY, JSON.stringify(map));
}

export function DashboardUserMenu({
  username,
  avatarUrl,
  profileHref,
  settingsHref,
  activeAccountId,
  availableAccounts = [],
}: DashboardUserMenuProps) {
  const [profileMenuOpen, setProfileMenuOpen] = useState(false);
  const [accountSwitcherOpen, setAccountSwitcherOpen] = useState(false);
  const [accountSwitcherTooltipOpen, setAccountSwitcherTooltipOpen] = useState(false);
  const [switchingAccountId, setSwitchingAccountId] = useState<string | null>(null);
  const [isSigningOut, setIsSigningOut] = useState(false);
  const profileMenuRef = useRef<HTMLDivElement | null>(null);
  const canSwitchAccounts = Boolean(activeAccountId && availableAccounts.length > 0);

  useEffect(() => {
    function handlePointerDown(event: MouseEvent) {
      if (!profileMenuRef.current?.contains(event.target as Node)) {
        setAccountSwitcherTooltipOpen(false);
        setAccountSwitcherOpen(false);
        setProfileMenuOpen(false);
      }
    }

    function handleEscape(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setAccountSwitcherTooltipOpen(false);
        setAccountSwitcherOpen(false);
        setProfileMenuOpen(false);
      }
    }

    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("keydown", handleEscape);
    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("keydown", handleEscape);
    };
  }, []);

  useEffect(() => {
    if (!profileMenuOpen) {
      setAccountSwitcherTooltipOpen(false);
      setAccountSwitcherOpen(false);
    }
  }, [profileMenuOpen]);

  async function handleSignOut() {
    if (isSigningOut) return;
    setIsSigningOut(true);
    try {
      await fetch("/api/auth/logout", { method: "POST" });
    } finally {
      window.location.href = "/sign-in";
    }
  }

  function handleAddAccount() {
    window.location.href = "/sign-in?intent=add-account";
  }

  async function handleSwitchAccount(userContextId: string) {
    if (!activeAccountId || switchingAccountId || userContextId === activeAccountId) {
      setAccountSwitcherOpen(false);
      return;
    }

    writeStoredAccountPath(
      activeAccountId,
      `${window.location.pathname}${window.location.search}`
    );

    setSwitchingAccountId(userContextId);
    try {
      const response = await fetch("/api/auth/users/switch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userContextId }),
      });

      if (!response.ok) return;

      type SwitchResponse = {
        data?: { activeUser?: { id?: string; domain?: AccountDomain } };
      };
      const payload = (await response.json().catch(() => null)) as SwitchResponse | null;
      const switchedAccountId = payload?.data?.activeUser?.id ?? userContextId;
      const switchedDomain =
        payload?.data?.activeUser?.domain ??
        availableAccounts.find((account) => account.id === switchedAccountId)?.domain;
      const rememberedPath = readStoredAccountPath(switchedAccountId);
      const fallbackPath = switchedDomain === "GLOBAL" ? "/dashboard" : "/";

      setAccountSwitcherOpen(false);
      setProfileMenuOpen(false);
      window.location.href = rememberedPath ?? fallbackPath;
    } finally {
      setSwitchingAccountId(null);
    }
  }

  return (
    <div className="relative" ref={profileMenuRef}>
      <button
        type="button"
        aria-label="Profile"
        aria-expanded={profileMenuOpen}
        onClick={() =>
          setProfileMenuOpen((open) => {
            const nextOpen = !open;
            if (!nextOpen) setAccountSwitcherOpen(false);
            return nextOpen;
          })
        }
        className="inline-flex h-[32px] w-[32px] items-center justify-center rounded-full focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--color-blue-400)]"
      >
        <UserAvatar name={username} imageUrl={avatarUrl} />
      </button>

      {profileMenuOpen ? (
        <div className="absolute right-0 top-[42px] z-40 w-[300px] rounded-[14px] border border-slate-700 bg-slate-950 p-[10px] shadow-[0_16px_36px_rgba(0,0,0,0.52)]">
          <div className="flex items-center justify-between rounded-[10px] px-[6px] py-[6px]">
            <div className="flex min-w-0 items-center gap-[10px]">
              <UserAvatar size={32} name={username} imageUrl={avatarUrl} />
              <span className="truncate text-[14px] font-semibold leading-none text-slate-100">
                {username}
              </span>
            </div>

            {canSwitchAccounts ? (
              <div className="relative">
                <button
                  type="button"
                  aria-label="Account switcher"
                  aria-expanded={accountSwitcherOpen}
                  onMouseEnter={() => {
                    if (!accountSwitcherOpen) setAccountSwitcherTooltipOpen(true);
                  }}
                  onMouseLeave={() => setAccountSwitcherTooltipOpen(false)}
                  onFocus={() => {
                    if (!accountSwitcherOpen) setAccountSwitcherTooltipOpen(true);
                  }}
                  onBlur={() => setAccountSwitcherTooltipOpen(false)}
                  onClick={() => {
                    setAccountSwitcherTooltipOpen(false);
                    setAccountSwitcherOpen((open) => !open);
                  }}
                  className="inline-flex h-[32px] w-[32px] items-center justify-center rounded-[10px] bg-slate-900 text-slate-400 transition-colors hover:bg-slate-800/80 hover:text-slate-200 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--color-blue-400)]"
                >
                  <SwitchAccountIcon />
                </button>
                <span
                  className={`pointer-events-none absolute right-0 top-full mt-[10px] w-max whitespace-nowrap rounded-[10px] bg-slate-700 px-[14px] py-[8px] text-[13px] font-medium text-slate-100 shadow-[0_8px_24px_rgba(0,0,0,0.4)] transition-all duration-150 ${
                    accountSwitcherTooltipOpen && !accountSwitcherOpen
                      ? "opacity-100"
                      : "opacity-0"
                  }`}
                >
                  Account Switcher
                </span>

                {accountSwitcherOpen ? (
                  <div className="absolute right-0 top-full z-50 mt-[10px] w-[300px] overflow-hidden rounded-[18px] border border-slate-700 bg-slate-950 shadow-[0_18px_44px_rgba(0,0,0,0.56)]">
                    <div className="px-[14px] pb-[12px] pt-[14px]">
                      <p className="px-[6px] text-[12px] font-semibold text-slate-300">
                        Switch account
                      </p>
                      <div className="mt-[8px] space-y-[2px]">
                        {availableAccounts.map((account) => (
                          <button
                            key={account.id}
                            type="button"
                            onClick={() => handleSwitchAccount(account.id)}
                            disabled={switchingAccountId != null}
                            className={`flex w-full items-center gap-[12px] rounded-[12px] px-[6px] py-[8px] text-left transition-colors disabled:cursor-not-allowed disabled:opacity-60 ${
                              account.id === activeAccountId
                                ? "bg-slate-800/70"
                                : "hover:bg-slate-800/65"
                            }`}
                          >
                            <UserAvatar
                              size={20}
                              name={account.displayName}
                              imageUrl={account.avatarUrl}
                            />
                            <span className="flex min-w-0 items-baseline gap-[10px]">
                              <span className="truncate text-[14px] leading-none text-slate-100">
                                {account.displayName}
                              </span>
                              {account.organizationName ? (
                                <span className="truncate text-[14px] leading-none text-slate-400">
                                  {account.organizationName}
                                </span>
                              ) : null}
                            </span>
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className="border-t border-slate-800" />

                    <div className="space-y-[2px] px-[14px] py-[12px]">
                      <button
                        type="button"
                        onClick={handleAddAccount}
                        className="flex w-full items-center gap-[12px] rounded-[12px] px-[6px] py-[8px] text-left text-[14px] leading-none text-slate-100 transition-colors hover:bg-slate-800/65"
                      >
                        <span className="text-slate-400">
                          <AddAccountIcon />
                        </span>
                        <span>Add account</span>
                      </button>
                    </div>
                  </div>
                ) : null}
              </div>
            ) : null}
          </div>

          <div className="my-[8px] border-b border-slate-800" />

          <Link
            href={profileHref}
            onClick={() => setProfileMenuOpen(false)}
            className="flex w-full items-center gap-[10px] rounded-[8px] px-[10px] py-[9px] text-left text-[16px] font-medium text-slate-100 transition-colors hover:bg-slate-800/70 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--color-blue-400)]"
          >
            <span className="inline-flex h-[16px] w-[16px] shrink-0 items-center justify-center text-slate-400">
              <ProfileIcon />
            </span>
            <span>Profile</span>
          </Link>

          <Link
            href={settingsHref}
            onClick={() => setProfileMenuOpen(false)}
            className="flex w-full items-center gap-[10px] rounded-[8px] px-[10px] py-[9px] text-left text-[16px] font-medium text-slate-100 transition-colors hover:bg-slate-800/70 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--color-blue-400)]"
          >
            <span className="inline-flex h-[16px] w-[16px] shrink-0 items-center justify-center text-slate-400">
              <SettingsIcon />
            </span>
            <span>Settings</span>
          </Link>

          <div className="my-[8px] border-b border-slate-800" />

          <button
            type="button"
            onClick={handleSignOut}
            disabled={isSigningOut}
            className="flex w-full items-center gap-[10px] rounded-[8px] px-[10px] py-[9px] text-left text-[16px] font-medium text-slate-100 transition-colors hover:bg-slate-800/70 disabled:opacity-60"
          >
            <span className="inline-flex h-[16px] w-[16px] shrink-0 items-center justify-center text-slate-400">
              <SignOutIcon />
            </span>
            <span>{isSigningOut ? "Signing out..." : "Sign out"}</span>
          </button>
        </div>
      ) : null}
    </div>
  );
}

export { writeStoredAccountPath };
