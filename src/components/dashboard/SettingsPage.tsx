import Link from "next/link";
import { UserAvatar } from "@/lib/ui/user-avatar";
import type { SessionUser } from "@/lib/auth/session";
import { DeleteAccountDialog } from "@/app/dashboard/settings/account/DeleteAccountDialog";

interface SettingsPageProps {
  session: SessionUser;
  profileHref: string;
  settingsHref: string;
}

export function SettingsPage({ session, profileHref, settingsHref }: SettingsPageProps) {
  return (
    <main className="mx-auto max-w-[1320px] px-[16px] py-[24px] lg:px-[24px]">
      <div className="mb-[20px] flex flex-col gap-[14px] border-b border-slate-800 pb-[18px] lg:flex-row lg:items-center lg:justify-between">
        <div className="flex items-center gap-[14px]">
          <UserAvatar name={session.displayName} imageUrl={session.avatarUrl} />
          <div className="min-w-0">
            <p className="truncate text-[20px] font-semibold leading-none text-slate-100">
              {session.displayName}
            </p>
            <p className="truncate pt-[6px] text-[14px] leading-none text-slate-400">
              Your personal account
            </p>
          </div>
        </div>

        <Link
          href={profileHref}
          className="inline-flex h-[40px] items-center justify-center rounded-[10px] border border-slate-700 bg-slate-900/70 px-[16px] text-[14px] font-medium text-slate-200 transition-colors hover:bg-slate-800"
        >
          Go to your personal profile
        </Link>
      </div>

      <div className="grid gap-[24px] lg:grid-cols-[320px_1fr]">
        <aside className="border-b border-slate-800 pb-[20px] lg:border-b-0 lg:border-r lg:pr-[24px]">
          <nav className="space-y-[4px]" aria-label="Settings navigation">
            <div className="relative h-[44px]">
              <span className="absolute left-0 top-[8px] h-[28px] w-[6px] rounded-full bg-[color:var(--color-blue-500)]" />
              <Link
                href={settingsHref}
                className="ml-[10px] flex h-[44px] w-[calc(100%-10px)] items-center gap-[10px] rounded-[10px] bg-slate-800/80 px-[12px] text-left text-[14px] font-semibold text-slate-100"
              >
                <span>Account</span>
              </Link>
            </div>
          </nav>
        </aside>

        <section>
          <h1 className="text-[24px] font-semibold leading-none text-slate-100">
            Export account data
          </h1>
          <div className="mt-[14px] border-t border-slate-800" />

          <p className="pt-[20px] text-[15px] leading-[26px] text-slate-200">
            Export your EXPP profile information, assignments, generated content, and account
            metadata for @{session.displayName}. Exports will be available for 7 days.
          </p>

          <button
            type="button"
            className="mt-[14px] inline-flex items-center justify-center rounded-[10px] border border-slate-600 bg-slate-800/75 px-[16px] py-[5px] text-[14px] font-medium text-slate-100 transition-colors hover:bg-slate-700/75"
          >
            Start export
          </button>

          <h2 className="mt-[64px] text-[24px] font-semibold leading-none text-red-400">
            Delete account
          </h2>
          <div className="mt-[14px] border-t border-slate-800" />

          <p className="pt-[20px] text-[15px] leading-[26px] text-slate-200">
            Once you delete your account, there is no going back. Please be certain.
          </p>

          <DeleteAccountDialog username={session.displayName} email={session.email} />
        </section>
      </div>
    </main>
  );
}
