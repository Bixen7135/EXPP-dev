import Link from "next/link";
import { redirect } from "next/navigation";
import { resolveSession } from "@/lib/auth/session";
import { hasGoogleConnection } from "@/lib/auth/google-connection";
import { UserAvatar } from "@/lib/ui/user-avatar";

const SETTINGS_FONT_STACK =
  '-apple-system, BlinkMacSystemFont, "Segoe UI", Helvetica, Arial, sans-serif';

function AccountIcon() {
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

function AppearanceIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 16 16" className="h-[16px] w-[16px]" fill="currentColor">
      <path d="M11.134 1.535c.7-.509 1.416-.942 2.076-1.155.649-.21 1.463-.267 2.069.34.603.601.568 1.411.368 2.07-.202.668-.624 1.39-1.125 2.096-1.011 1.424-2.496 2.987-3.775 4.249-1.098 1.084-2.132 1.839-3.04 2.3a3.744 3.744 0 0 1-1.055 3.217c-.431.431-1.065.691-1.657.861-.614.177-1.294.287-1.914.357A21.151 21.151 0 0 1 .797 16H.743l.007-.75H.749L.742 16a.75.75 0 0 1-.743-.742l.743-.008-.742.007v-.054a21.25 21.25 0 0 1 .13-2.284c.067-.647.187-1.287.358-1.914.17-.591.43-1.226.86-1.657a3.746 3.746 0 0 1 3.227-1.054c.466-.893 1.225-1.907 2.314-2.982 1.271-1.255 2.833-2.75 4.245-3.777ZM1.62 13.089c-.051.464-.086.929-.104 1.395.466-.018.932-.053 1.396-.104a10.511 10.511 0 0 0 1.668-.309c.526-.151.856-.325 1.011-.48a2.25 2.25 0 1 0-3.182-3.182c-.155.155-.329.485-.48 1.01a10.515 10.515 0 0 0-.309 1.67Zm10.396-10.34c-1.224.89-2.605 2.189-3.822 3.384l1.718 1.718c1.21-1.205 2.51-2.597 3.387-3.833.47-.662.78-1.227.912-1.662.134-.444.032-.551.009-.575h-.001V1.78c-.014-.014-.113-.113-.548.027-.432.14-.995.462-1.655.942Zm-4.832 7.266-.001.001a9.859 9.859 0 0 0 1.63-1.142L7.155 7.216a9.7 9.7 0 0 0-1.161 1.607c.482.302.889.71 1.19 1.192Z" />
    </svg>
  );
}

function AccessibilityIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 16 16" className="h-[16px] w-[16px]" fill="currentColor">
      <path d="M9.923 5.302c.063.063.122.129.178.198H14A.75.75 0 0 1 14 7h-3.3l.578 5.163.362 2.997a.75.75 0 0 1-1.49.18L9.868 13H6.132l-.282 2.34a.75.75 0 0 1-1.49-.18l.362-2.997L5.3 7H2a.75.75 0 0 1 0-1.5h3.9a2.54 2.54 0 0 1 .176-.198 3 3 0 1 1 3.847 0ZM9.2 7.073h-.001a1.206 1.206 0 0 0-2.398 0L6.305 11.5h3.39ZM9.5 3a1.5 1.5 0 1 0-3.001.001A1.5 1.5 0 0 0 9.5 3Z" />
    </svg>
  );
}

function NotificationsIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" className="h-[16px] w-[16px]">
      <path
        d="M7 10.5a5 5 0 1 1 10 0v4l1.7 2.4a.8.8 0 0 1-.7 1.3H6a.8.8 0 0 1-.7-1.3L7 14.5v-4zM10 19.2a2 2 0 0 0 4 0"
        fill="none"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.8"
      />
    </svg>
  );
}

function EmailIcon({ className = "h-[16px] w-[16px]" }: { className?: string }) {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" className={className}>
      <path
        d="M3 6h18v12H3zM3 7l9 6 9-6"
        fill="none"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.8"
      />
    </svg>
  );
}

function PasswordIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 16 16" className="h-[16px] w-[16px]" fill="currentColor">
      <path d="M8.75 8.582v5.668a.75.75 0 0 1-1.5 0V8.582a1.75 1.75 0 1 1 1.5 0Zm3.983-7.125a.75.75 0 0 1 1.06.026A7.976 7.976 0 0 1 16 7c0 2.139-.84 4.083-2.207 5.517a.75.75 0 1 1-1.086-1.034A6.474 6.474 0 0 0 14.5 7a6.474 6.474 0 0 0-1.793-4.483.75.75 0 0 1 .026-1.06Zm-9.466 0c.3.286.312.76.026 1.06A6.474 6.474 0 0 0 1.5 7a6.47 6.47 0 0 0 1.793 4.483.75.75 0 0 1-1.086 1.034A7.973 7.973 0 0 1 0 7c0-2.139.84-4.083 2.207-5.517a.75.75 0 0 1 1.06-.026Zm8.556 2.321A4.988 4.988 0 0 1 13 7a4.988 4.988 0 0 1-1.177 3.222.75.75 0 1 1-1.146-.967A3.487 3.487 0 0 0 11.5 7c0-.86-.309-1.645-.823-2.255a.75.75 0 0 1 1.146-.967Zm-6.492.958A3.48 3.48 0 0 0 4.5 7a3.48 3.48 0 0 0 .823 2.255.75.75 0 0 1-1.146.967A4.981 4.981 0 0 1 3 7a4.982 4.982 0 0 1 1.188-3.236.75.75 0 1 1 1.143.972Z" />
    </svg>
  );
}

function GoogleIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 16 16" className="h-6 w-6">
      <g clipPath="url(#google-clip-settings)">
        <path
          d="M8.00018 3.16667C9.18018 3.16667 10.2368 3.57333 11.0702 4.36667L13.3535 2.08333C11.9668 0.793333 10.1568 0 8.00018 0C4.87352 0 2.17018 1.79333 0.853516 4.40667L3.51352 6.47C4.14352 4.57333 5.91352 3.16667 8.00018 3.16667Z"
          fill="#EA4335"
        />
        <path
          d="M15.66 8.18335C15.66 7.66002 15.61 7.15335 15.5333 6.66669H8V9.67335H12.3133C12.12 10.66 11.56 11.5 10.72 12.0667L13.2967 14.0667C14.8 12.6734 15.66 10.6134 15.66 8.18335Z"
          fill="#4285F4"
        />
        <path
          d="M3.51 9.53001C3.35 9.04668 3.25667 8.53334 3.25667 8.00001C3.25667 7.46668 3.34667 6.95334 3.51 6.47001L0.85 4.40668C0.306667 5.48668 0 6.70668 0 8.00001C0 9.29334 0.306667 10.5133 0.853333 11.5933L3.51 9.53001Z"
          fill="#FBBC05"
        />
        <path
          d="M8.0001 16C10.1601 16 11.9768 15.29 13.2968 14.0633L10.7201 12.0633C10.0034 12.5467 9.0801 12.83 8.0001 12.83C5.91343 12.83 4.14343 11.4233 3.5101 9.52667L0.850098 11.59C2.1701 14.2067 4.87343 16 8.0001 16Z"
          fill="#34A853"
        />
      </g>
      <defs>
        <clipPath id="google-clip-settings">
          <rect width="16" height="16" fill="white" />
        </clipPath>
      </defs>
    </svg>
  );
}

function AppleIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 1 16 14.5318" fill="none" className="h-[24px] w-auto">
      <path
        d="M8.08803 4.3535C8.74395 4.3535 9.56615 3.91006 10.0558 3.31881C10.4992 2.78299 10.8226 2.03469 10.8226 1.28639C10.8226 1.18477 10.8133 1.08314 10.7948 1C10.065 1.02771 9.18738 1.48963 8.6608 2.10859C8.24508 2.57975 7.86631 3.31881 7.86631 4.07635C7.86631 4.18721 7.88479 4.29807 7.89402 4.33502C7.94021 4.34426 8.01412 4.3535 8.08803 4.3535ZM5.77846 15.5318C6.67457 15.5318 7.07182 14.9313 8.18965 14.9313C9.32596 14.9313 9.57539 15.5133 10.5731 15.5133C11.5524 15.5133 12.2083 14.608 12.8273 13.7211C13.5201 12.7049 13.8065 11.7072 13.825 11.661C13.7603 11.6425 11.885 10.8757 11.885 8.7232C11.885 6.85707 13.3631 6.01639 13.4462 5.95172C12.467 4.5475 10.9796 4.51055 10.5731 4.51055C9.47377 4.51055 8.57766 5.1757 8.01412 5.1757C7.4044 5.1757 6.60066 4.5475 5.64912 4.5475C3.83842 4.5475 2 6.0441 2 8.87101C2 10.6263 2.68363 12.4832 3.52432 13.6842C4.2449 14.7004 4.87311 15.5318 5.77846 15.5318Z"
        fill="currentColor"
      />
    </svg>
  );
}

function SessionsIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 16 16" className="h-[16px] w-[16px]" fill="currentColor">
      <path d="m8.533.133 5.25 1.68A1.75 1.75 0 0 1 15 3.48V7c0 1.566-.32 3.182-1.303 4.682-.983 1.498-2.585 2.813-5.032 3.855a1.697 1.697 0 0 1-1.33 0c-2.447-1.042-4.049-2.357-5.032-3.855C1.32 10.182 1 8.566 1 7V3.48a1.75 1.75 0 0 1 1.217-1.667l5.25-1.68a1.748 1.748 0 0 1 1.066 0Zm-.61 1.429.001.001-5.25 1.68a.251.251 0 0 0-.174.237V7c0 1.36.275 2.666 1.057 3.859.784 1.194 2.121 2.342 4.366 3.298a.196.196 0 0 0 .154 0c2.245-.957 3.582-2.103 4.366-3.297C13.225 9.666 13.5 8.358 13.5 7V3.48a.25.25 0 0 0-.174-.238l-5.25-1.68a.25.25 0 0 0-.153 0ZM9.5 6.5c0 .536-.286 1.032-.75 1.3v2.45a.75.75 0 0 1-1.5 0V7.8A1.5 1.5 0 1 1 9.5 6.5Z" />
    </svg>
  );
}

function TwoFactorLockIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" className="h-[28px] w-[28px]" fill="none">
      <path
        d="M7 11V8a5 5 0 1 1 10 0v3M6 11h12a1 1 0 0 1 1 1v8a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1v-8a1 1 0 0 1 1-1Z"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.9"
      />
    </svg>
  );
}

function ThreeDotsIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 16 16" className="h-[16px] w-[16px]" fill="currentColor">
      <path d="M8 9a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3ZM1.5 9a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3Zm13 0a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3Z" />
    </svg>
  );
}

function PasswordMethodIcon() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      width="24"
      height="24"
      className="h-[24px] w-[24px]"
      fill="currentColor"
    >
      <g transform="translate(12 12.5) scale(1.2) translate(-12 -12.5)">
        <path d="M22 9.75v5.5A1.75 1.75 0 0 1 20.25 17H3.75A1.75 1.75 0 0 1 2 15.25v-5.5C2 8.784 2.784 8 3.75 8h16.5c.966 0 1.75.784 1.75 1.75Zm-8.75 2.75a1.25 1.25 0 1 0-2.5 0 1.25 1.25 0 0 0 2.5 0Zm-6.5 1.25a1.25 1.25 0 1 0 0-2.5 1.25 1.25 0 0 0 0 2.5Zm10.5 0a1.25 1.25 0 1 0 0-2.5 1.25 1.25 0 0 0 0 2.5Z" />
      </g>
    </svg>
  );
}

export default async function DashboardPasswordAuthenticationSettingsPage() {
  const session = await resolveSession();
  if (!session) {
    redirect("/login");
  }
  if (session.domain !== "GLOBAL") {
    redirect("/");
  }
  const isGoogleConnected = hasGoogleConnection(session);

  return (
    <main
      className="min-h-screen bg-slate-950 text-slate-100"
      style={{ fontFamily: SETTINGS_FONT_STACK }}
    >
      <header className="border-b border-slate-800/90 bg-slate-950/90">
        <div className="mx-auto flex h-[64px] max-w-[1320px] items-center px-[16px] lg:px-[24px]">
          <h1 className="text-[14px] font-semibold tracking-[-0.01em] text-slate-100">Settings</h1>
        </div>
      </header>

      <div className="mx-auto max-w-[1320px] px-[16px] py-[24px] lg:px-[24px]">
        <div className="mb-[20px] flex flex-col gap-[14px] border-b border-slate-800 pb-[18px] lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-center gap-[14px]">
            <UserAvatar name={session.displayName} imageUrl={session.avatarUrl} />
            <div className="min-w-0">
              <p className="truncate text-[20px] font-semibold leading-none text-slate-100">
                {session.displayName}
              </p>
              <p className="truncate pt-[6px] text-[14px] leading-none text-slate-400">Your personal account</p>
            </div>
          </div>

          <Link
            href="/dashboard/profile"
            className="inline-flex h-[40px] items-center justify-center rounded-[10px] border border-slate-700 bg-slate-900/70 px-[16px] text-[14px] font-medium text-slate-200 transition-colors hover:bg-slate-800"
          >
            Go to your personal profile
          </Link>
        </div>

        <div className="grid gap-[24px] lg:grid-cols-[320px_1fr]">
          <aside className="border-b border-slate-800 pb-[20px] lg:border-b-0 lg:border-r lg:pr-[24px]">
            <nav className="space-y-[4px]">
              <Link
                href="/dashboard/settings/account"
                className="flex h-[40px] w-full items-center gap-[10px] rounded-[10px] px-[12px] text-left text-[14px] text-slate-200 transition-colors hover:bg-slate-800/60"
              >
                <span className="text-slate-400">
                  <AccountIcon />
                </span>
                <span>Account</span>
              </Link>

              <button
                type="button"
                className="flex h-[40px] w-full items-center gap-[10px] rounded-[10px] px-[12px] text-left text-[14px] text-slate-200 transition-colors hover:bg-slate-800/60"
              >
                <span className="text-slate-400">
                  <AppearanceIcon />
                </span>
                <span>Appearance</span>
              </button>

              <button
                type="button"
                className="flex h-[40px] w-full items-center gap-[10px] rounded-[10px] px-[12px] text-left text-[14px] text-slate-200 transition-colors hover:bg-slate-800/60"
              >
                <span className="text-slate-400">
                  <AccessibilityIcon />
                </span>
                <span>Accessibility</span>
              </button>

              <button
                type="button"
                className="flex h-[40px] w-full items-center gap-[10px] rounded-[10px] px-[12px] text-left text-[14px] text-slate-200 transition-colors hover:bg-slate-800/60"
              >
                <span className="text-slate-400">
                  <NotificationsIcon />
                </span>
                <span>Notifications</span>
              </button>
            </nav>

            <div className="mt-[16px] border-t border-slate-800 pt-[16px]">
              <p className="px-[12px] pb-[8px] text-[14px] font-medium text-slate-400">Access</p>

              <nav className="space-y-[4px]">
                <Link
                  href="/dashboard/settings/emails"
                  className="flex h-[40px] w-full items-center gap-[10px] rounded-[10px] px-[12px] text-left text-[14px] text-slate-200 transition-colors hover:bg-slate-800/60"
                >
                  <span className="text-slate-400">
                    <EmailIcon />
                  </span>
                  <span>Emails</span>
                </Link>

                <Link
                  href="/dashboard/settings/password-authentication"
                  className="flex h-[44px] w-full items-center gap-[10px] rounded-[10px] bg-slate-800/80 px-[12px] text-left text-[14px] font-semibold text-slate-100"
                >
                  <span className="text-slate-300">
                    <SessionsIcon />
                  </span>
                  <span>Password and authentication</span>
                </Link>

                <Link
                  href="/dashboard/settings/sessions"
                  className="flex h-[40px] w-full items-center gap-[10px] rounded-[10px] px-[12px] text-left text-[14px] text-slate-200 transition-colors hover:bg-slate-800/60"
                >
                  <span className="text-slate-400">
                    <PasswordIcon />
                  </span>
                  <span>Sessions</span>
                </Link>
              </nav>
            </div>
          </aside>

          <section className="pt-[2px]">
            <h2 className="text-[24px] font-semibold leading-none text-slate-100">Sign in methods</h2>

            <div className="mt-[18px] overflow-hidden rounded-[18px] border border-slate-700/80 bg-slate-900/70">
              <div className="px-[24px] py-[8px]">
                <div className="flex min-h-[64px] flex-col gap-[10px] sm:flex-row sm:items-center sm:gap-[28px]">
                  <div className="flex items-start gap-[12px]">
                    <span className="shrink-0 pt-[2px] text-slate-300">
                      <EmailIcon className="h-[24px] w-[24px]" />
                    </span>
                    <div>
                      <p className="text-[18px] font-semibold leading-none text-slate-100">Email</p>
                      <p className="pt-[8px] text-[14px] leading-none text-slate-400">1 verified email configured</p>
                    </div>
                  </div>
                  <button
                    type="button"
                    className="inline-flex h-[50px] w-[90px] items-center justify-center rounded-[16px] border border-slate-600/90 bg-slate-800/70 px-[26px] text-[14px] font-medium leading-none text-slate-100 transition-colors hover:bg-slate-700/75 sm:ml-auto"
                  >
                    Manage
                  </button>
                </div>
              </div>

              <div className="border-t border-slate-700/60" />

              <div className="px-[24px] py-[8px]">
                <div className="flex min-h-[64px] flex-col gap-[10px] sm:flex-row sm:items-center sm:gap-[28px]">
                  <div className="flex items-start gap-[12px]">
                    <span className="shrink-0 pt-[2px] text-slate-300">
                      <PasswordMethodIcon />
                    </span>
                    <div>
                      <p className="text-[18px] font-semibold leading-none text-slate-100">Password</p>
                      <p className="pt-[8px] text-[14px] leading-none text-slate-400">Configured</p>
                    </div>
                  </div>
                  <button
                    type="button"
                    className="inline-flex h-[50px] w-[90px] items-center justify-center rounded-[16px] border border-slate-600/90 bg-slate-800/70 px-[26px] text-[14px] font-medium leading-none text-slate-100 transition-colors hover:bg-slate-700/75 sm:ml-auto"
                  >
                    Change
                  </button>
                </div>
              </div>

              <div className="border-t border-slate-700/60" />

              <div className="px-[24px] py-[8px]">
                <div className="flex min-h-[64px] flex-col gap-[10px] sm:flex-row sm:items-center sm:gap-[28px]">
                  <div className="flex items-start gap-[12px]">
                    <span className="shrink-0 pt-[2px]">
                      <GoogleIcon />
                    </span>
                    <div>
                      <p className="text-[18px] font-semibold leading-none text-slate-100">Google</p>
                      <p className="pt-[8px] text-[14px] leading-none text-slate-400">
                        {isGoogleConnected ? "Signed in with Google" : "No Google account connected"}
                      </p>
                    </div>
                  </div>
                  {isGoogleConnected ? (
                    <button
                      type="button"
                      aria-label="Google connection options"
                      className="inline-flex h-[76px] w-[30px] items-center justify-center rounded-[15px] border border-slate-600/90 bg-slate-800/70 text-slate-100 transition-colors hover:bg-slate-700/75 sm:ml-auto"
                    >
                      <ThreeDotsIcon />
                    </button>
                  ) : (
                    <button
                      type="button"
                      className="inline-flex h-[50px] w-[90px] items-center justify-center rounded-[16px] border border-slate-600/90 bg-slate-800/70 px-[26px] text-[14px] font-medium leading-none text-slate-100 transition-colors hover:bg-slate-700/75 sm:ml-auto"
                    >
                      Connect
                    </button>
                  )}
                </div>
              </div>

              <div className="border-t border-slate-700/60" />

              <div className="px-[24px] py-[8px]">
                <div className="flex min-h-[64px] flex-col gap-[10px] sm:flex-row sm:items-center sm:gap-[28px]">
                  <div className="flex items-start gap-[12px]">
                    <span className="shrink-0 pt-[2px] text-slate-100">
                      <AppleIcon />
                    </span>
                    <div>
                      <p className="text-[18px] font-semibold leading-none text-slate-100">Apple</p>
                      <p className="pt-[8px] text-[14px] leading-none text-slate-400">Sign in with your Apple account</p>
                    </div>
                  </div>
                  <button
                    type="button"
                    className="inline-flex h-[50px] w-[90px] items-center justify-center rounded-[16px] border border-slate-600/90 bg-slate-800/70 px-[26px] text-[14px] font-medium leading-none text-slate-100 transition-colors hover:bg-slate-700/75 sm:ml-auto"
                  >
                    Connect
                  </button>
                </div>
              </div>
            </div>

            <h3 className="mt-[64px] text-[24px] font-semibold leading-none text-slate-100">
              Two-factor authentication
            </h3>
            <div className="mt-[14px] border-t border-slate-800" />

            <div className="mx-auto max-w-[700px] py-[64px] text-center">
              <span className="inline-flex text-slate-400">
                <TwoFactorLockIcon />
              </span>
              <p className="pt-[18px] text-[28px] font-semibold leading-none text-slate-100">
                Two-factor authentication is not enabled yet.
              </p>
              <p className="mx-auto max-w-[620px] pt-[16px] text-[14px] leading-[28px] text-slate-400">
                Two-factor authentication adds an additional layer of security to your account by requiring
                more than just a password to sign in.
              </p>

              <button
                type="button"
                className="mt-[22px] inline-flex h-[40px] items-center justify-center rounded-[10px] border border-emerald-500 bg-emerald-600 px-[16px] py-[5px] text-[14px] font-medium text-white transition-colors hover:bg-emerald-500"
              >
                Enable two-factor authentication
              </button>

              <Link
                href="#"
                className="mx-auto mt-[16px] block w-fit text-[14px] text-blue-400 transition-colors hover:text-blue-300"
              >
                Learn more
              </Link>
            </div>
          </section>
        </div>
      </div>
    </main>
  );
}
