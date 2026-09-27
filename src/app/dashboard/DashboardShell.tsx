"use client";

import { useEffect, useRef, useState } from "react";
import { UserAvatar } from "@/lib/ui/user-avatar";

const SHELL_FONT_STACK =
  '-apple-system, BlinkMacSystemFont, "Segoe UI", Helvetica, Arial, sans-serif';

function MenuIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" className="h-[14px] w-[14px]">
      <path
        d="M4 7h16M4 12h16M4 17h16"
        fill="none"
        stroke="currentColor"
        strokeLinecap="round"
        strokeWidth="1.6"
      />
    </svg>
  );
}

function HomeIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" className="h-[16px] w-[16px]">
      <path
        d="M4 11.2L12 4.8l8 6.4v7.2c0 .9-.7 1.6-1.6 1.6H5.6c-.9 0-1.6-.7-1.6-1.6v-7.2z"
        fill="none"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.9"
      />
      <path
        d="M9.2 20V13.4h5.6V20"
        fill="none"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.9"
      />
    </svg>
  );
}

function CloseIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" className="h-[14px] w-[14px]">
      <path
        d="M7 7l10 10M17 7L7 17"
        fill="none"
        stroke="currentColor"
        strokeLinecap="round"
        strokeWidth="1.8"
      />
    </svg>
  );
}

function LogoPlaceholder() {
  return (
    <div className="relative h-[32px] w-[32px] rounded-full border border-slate-300 bg-slate-100">
      <div className="absolute left-[8px] top-[8px] h-[16px] w-[16px] rounded-sm border border-slate-500 bg-slate-300" />
    </div>
  );
}

function SwitchAccountIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" className="h-[18px] w-[18px]">
      <path
        d="M4 7h13M13 4l4 3-4 3M20 17H7M11 14l-4 3 4 3"
        fill="none"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.8"
      />
    </svg>
  );
}

function PersonMenuIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" className="h-[16px] w-[16px]">
      <path
        d="M12 12a4.2 4.2 0 1 0 0-8.4 4.2 4.2 0 0 0 0 8.4zM4 20a8 8 0 0 1 16 0"
        fill="none"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.8"
      />
    </svg>
  );
}

function SettingsMenuIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" className="h-[16px] w-[16px]">
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
    </svg>
  );
}

function SignOutMenuIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" className="h-[16px] w-[16px]">
      <path
        d="M10 5H6a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h4M14 8l5 4-5 4M8 12h11"
        fill="none"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.8"
      />
    </svg>
  );
}

function AddAccountMenuIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" className="h-[16px] w-[16px]">
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
        d="M2 18.2a6.2 6.2 0 0 1 12.4 0"
        fill="none"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.8"
      />
      <path
        d="M18.5 3.5v5M16 6h5"
        fill="none"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.8"
      />
    </svg>
  );
}

interface DashboardShellProps {
  username: string;
  avatarUrl: string | null;
  activeAccountId: string;
  availableAccounts: Array<{
    id: string;
    domain: "GLOBAL" | "ORGANIZATION";
    displayName: string;
    avatarUrl: string | null;
    organizationId: string | null;
    organizationName: string | null;
  }>;
}

export function DashboardShell({
  username,
  avatarUrl,
  activeAccountId,
  availableAccounts,
}: DashboardShellProps) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [profileMenuOpen, setProfileMenuOpen] = useState(false);
  const [accountSwitcherOpen, setAccountSwitcherOpen] = useState(false);
  const [accountSwitcherTooltipOpen, setAccountSwitcherTooltipOpen] = useState(false);
  const [switchingAccountId, setSwitchingAccountId] = useState<string | null>(null);
  const [isSigningOut, setIsSigningOut] = useState(false);
  const profileMenuRef = useRef<HTMLDivElement | null>(null);

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

  useEffect(() => {
    if (accountSwitcherOpen) {
      setAccountSwitcherTooltipOpen(false);
    }
  }, [accountSwitcherOpen]);

  async function handleSignOut() {
    if (isSigningOut) return;
    setIsSigningOut(true);
    try {
      await fetch("/api/auth/logout", { method: "POST" });
    } finally {
      window.location.href = "/login";
    }
  }

  function handleAddAccount() {
    window.location.href = "/login?intent=add-account";
  }

  function handleOpenSettings() {
    window.location.href = "/dashboard/settings";
  }

  function handleOpenProfile() {
    window.location.href = "/dashboard/profile";
  }

  async function handleSwitchAccount(userContextId: string) {
    if (switchingAccountId || userContextId === activeAccountId) {
      setAccountSwitcherOpen(false);
      return;
    }

    setSwitchingAccountId(userContextId);
    try {
      const response = await fetch("/api/auth/users/switch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userContextId }),
      });

      if (!response.ok) return;

      setAccountSwitcherOpen(false);
      setProfileMenuOpen(false);
      window.location.reload();
    } finally {
      setSwitchingAccountId(null);
    }
  }

  return (
    <main
      className="min-h-screen bg-slate-950 text-slate-100"
      style={{ fontFamily: SHELL_FONT_STACK }}
    >
      <div className="relative min-h-screen overflow-x-hidden">
        <header className="h-[60px] border-b border-slate-800 px-[16px]">
          <div className="flex h-full items-center justify-between">
            <div className="flex items-center gap-[12px]">
              <button
                type="button"
                aria-label="Open sidebar"
                onClick={() => setSidebarOpen(true)}
                className="inline-flex h-[32px] w-[32px] items-center justify-center rounded-[7px] border border-slate-700 text-slate-300 transition-colors hover:bg-slate-800/60"
              >
                <MenuIcon />
              </button>
              <LogoPlaceholder />
              <span className="text-[14px] font-semibold leading-none text-slate-100">Dashboard</span>
            </div>
            <div className="relative" ref={profileMenuRef}>
              <button
                type="button"
                aria-label="Profile"
                aria-expanded={profileMenuOpen}
                onClick={() =>
                  setProfileMenuOpen((open) => {
                    const nextOpen = !open;
                    if (!nextOpen) {
                      setAccountSwitcherOpen(false);
                    }
                    return nextOpen;
                  })
                }
                className="inline-flex h-[32px] w-[32px] items-center justify-center rounded-full"
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

                    <div className="relative">
                      <button
                        type="button"
                        aria-label="Account switcher"
                        aria-expanded={accountSwitcherOpen}
                        onMouseEnter={() => {
                          if (!accountSwitcherOpen) {
                            setAccountSwitcherTooltipOpen(true);
                          }
                        }}
                        onMouseLeave={() => setAccountSwitcherTooltipOpen(false)}
                        onFocus={() => {
                          if (!accountSwitcherOpen) {
                            setAccountSwitcherTooltipOpen(true);
                          }
                        }}
                        onBlur={() => setAccountSwitcherTooltipOpen(false)}
                        onClick={() => {
                          setAccountSwitcherTooltipOpen(false);
                          setAccountSwitcherOpen((open) => !open);
                        }}
                        className="inline-flex h-[32px] w-[32px] items-center justify-center rounded-[10px] bg-slate-900 text-slate-400 transition-colors hover:bg-slate-800/80 hover:text-slate-200"
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
                              {availableAccounts.map((account) => {
                                return (
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
                                );
                              })}
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
                                <AddAccountMenuIcon />
                              </span>
                              <span>Add account</span>
                            </button>

                            <button
                              type="button"
                              onClick={handleSignOut}
                              disabled={isSigningOut}
                              className="flex w-full items-center gap-[12px] rounded-[12px] px-[6px] py-[8px] text-left text-[14px] leading-none text-slate-100 transition-colors hover:bg-slate-800/65 disabled:opacity-60"
                            >
                              <span className="text-slate-400">
                                <SignOutMenuIcon />
                              </span>
                              <span>{isSigningOut ? "Signing out..." : "Sign out..."}</span>
                            </button>
                          </div>
                        </div>
                      ) : null}
                    </div>
                  </div>

                  <div className="my-[8px] border-b border-slate-800" />

                  <button
                    type="button"
                    onClick={() => {
                      setAccountSwitcherOpen(false);
                      setProfileMenuOpen(false);
                      handleOpenProfile();
                    }}
                    className="flex w-full items-center gap-[10px] rounded-[8px] px-[10px] py-[9px] text-left text-[16px] font-medium text-slate-100 transition-colors hover:bg-slate-800/70"
                  >
                    <span className="inline-flex h-[16px] w-[16px] shrink-0 items-center justify-center text-slate-400">
                      <PersonMenuIcon />
                    </span>
                    <span>Profile</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setAccountSwitcherOpen(false);
                      setProfileMenuOpen(false);
                      handleOpenSettings();
                    }}
                    className="flex w-full items-center gap-[10px] rounded-[8px] px-[10px] py-[9px] text-left text-[16px] font-medium text-slate-100 transition-colors hover:bg-slate-800/70"
                  >
                    <span className="inline-flex h-[16px] w-[16px] shrink-0 items-center justify-center text-slate-400">
                      <SettingsMenuIcon />
                    </span>
                    <span>Settings</span>
                  </button>

                  <div className="my-[8px] border-b border-slate-800" />

                  <button
                    type="button"
                    onClick={handleSignOut}
                    disabled={isSigningOut}
                    className="flex w-full items-center gap-[10px] rounded-[8px] px-[10px] py-[9px] text-left text-[16px] font-medium text-slate-100 transition-colors hover:bg-slate-800/70 disabled:opacity-60"
                  >
                    <span className="inline-flex h-[16px] w-[16px] shrink-0 items-center justify-center text-slate-400">
                      <SignOutMenuIcon />
                    </span>
                    <span>{isSigningOut ? "Signing out..." : "Sign out"}</span>
                  </button>
                </div>
              ) : null}
            </div>
          </div>
        </header>

        <div className="flex min-h-[calc(100vh-60px)]">
          <aside className="w-[324px] shrink-0 border-r border-slate-800" />
          <section className="flex-1 pl-[24px] pt-[12px]">
            <h1 className="text-[24px] font-semibold leading-[36px] text-slate-200">Home</h1>
          </section>
        </div>

        <aside
          className={`absolute left-0 top-0 z-20 h-full w-[324px] overflow-hidden rounded-r-[14px] border border-slate-700 bg-slate-950 transition-transform duration-200 ease-out ${
            sidebarOpen ? "translate-x-0" : "-translate-x-full"
          }`}
          aria-hidden={!sidebarOpen}
        >
          <div className="h-[60px] px-[14px]">
            <div className="flex h-full items-center justify-between">
              <LogoPlaceholder />
              <button
                type="button"
                aria-label="Close sidebar"
                onClick={() => setSidebarOpen(false)}
                className="inline-flex h-[28px] w-[28px] items-center justify-center rounded-[6px] text-slate-400 transition-colors hover:bg-slate-800/60 hover:text-slate-200"
              >
                <CloseIcon />
              </button>
            </div>
          </div>

          <div className="px-[8px] pt-[26px]">
            <div className="relative h-[32px]">
              <span className="absolute left-0 top-[2px] h-[28px] w-[6px] rounded-full bg-blue-500" />
              <button
                type="button"
                className="ml-[10px] flex h-[32px] w-[calc(100%-10px)] items-center rounded-[8px] bg-slate-800/70 px-[14px] text-left"
              >
                <span className="inline-flex items-center justify-center text-slate-400">
                  <HomeIcon />
                </span>
                <span className="ml-[10px] text-[14px] font-semibold leading-none text-slate-100">Home</span>
              </button>
            </div>

            <p className="pl-[14px] pt-[26px] text-[12px] font-normal leading-none text-slate-400">Show more</p>

            <div className="mt-[20px] border-b border-slate-800" />
          </div>
        </aside>
      </div>
    </main>
  );
}
