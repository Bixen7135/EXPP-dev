import Link from "next/link";
import { UserAvatar } from "@/lib/ui/user-avatar";
import { ProfilePictureEditor } from "@/app/dashboard/settings/ProfilePictureEditor";
import type { SessionUser } from "@/lib/auth/session";

interface ProfilePageProps {
  session: SessionUser;
  profileHref: string;
  settingsHref: string;
}

export function ProfilePage({ session, profileHref, settingsHref }: ProfilePageProps) {
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
          href={settingsHref}
          className="inline-flex h-[40px] items-center justify-center rounded-[10px] border border-slate-700 bg-slate-800/70 px-[16px] text-[14px] font-medium text-slate-100 transition-colors hover:bg-slate-700/70"
        >
          Go to account settings
        </Link>
      </div>

      <div className="grid gap-[24px] lg:grid-cols-[320px_1fr]">
        <aside className="border-b border-slate-800 pb-[20px] lg:border-b-0 lg:border-r lg:pr-[24px]">
          <nav className="space-y-[4px]" aria-label="Profile navigation">
            <div className="relative h-[44px]">
              <span className="absolute left-0 top-[8px] h-[28px] w-[6px] rounded-full bg-[color:var(--color-blue-500)]" />
              <Link
                href={profileHref}
                className="ml-[10px] flex h-[44px] w-[calc(100%-10px)] items-center gap-[10px] rounded-[10px] bg-slate-800/80 px-[12px] text-left text-[14px] font-semibold text-slate-100"
              >
                <span>Public profile</span>
              </Link>
            </div>
          </nav>
        </aside>

        <section>
          <h1 className="text-[36px] font-semibold leading-none text-slate-100">
            Public profile
          </h1>
          <div className="mt-[14px] border-t border-slate-800" />

          <div className="mt-[18px] grid gap-[24px] xl:grid-cols-[1fr_320px]">
            <div>
              <label htmlFor="profile-name" className="block text-[14px] font-semibold text-slate-100">
                Name
              </label>
              <input
                id="profile-name"
                type="text"
                defaultValue={session.displayName}
                className="mt-[8px] h-[44px] w-full rounded-[10px] border border-slate-700 bg-slate-900 px-[12px] text-[14px] text-slate-100 outline-none ring-0 transition-colors placeholder:text-slate-500 focus:border-slate-500"
              />
              <p className="pt-[8px] text-[14px] leading-[20px] text-slate-400">
                Your name may appear around the platform where you contribute or are mentioned.
              </p>

              <label htmlFor="public-email" className="mt-[18px] block text-[14px] font-semibold text-slate-100">
                Public email
              </label>
              <select
                id="public-email"
                className="mt-[8px] h-[44px] w-full rounded-[10px] border border-slate-700 bg-slate-900 px-[12px] text-[14px] text-slate-100 outline-none transition-colors focus:border-slate-500"
                defaultValue={session.email}
              >
                <option value={session.email}>{session.email}</option>
              </select>
              <p className="pt-[8px] text-[14px] leading-[20px] text-slate-400">
                You can manage verified email addresses in your account settings.
              </p>

              <label htmlFor="bio" className="mt-[18px] block text-[14px] font-semibold text-slate-100">
                Bio
              </label>
              <textarea
                id="bio"
                placeholder="Tell us a little bit about yourself"
                rows={5}
                className="mt-[8px] w-full resize-y rounded-[10px] border border-slate-700 bg-slate-900 px-[12px] py-[10px] text-[14px] text-slate-100 outline-none transition-colors placeholder:text-slate-500 focus:border-slate-500"
              />

              <p className="pt-[18px] text-[14px] leading-[30px] text-slate-400">
                All of the fields on this page are optional and can be deleted at any time.
              </p>

              <button
                type="button"
                className="mt-[14px] inline-flex items-center justify-center rounded-[12px] border border-emerald-500 bg-emerald-600 px-[16px] py-[5px] text-[14px] font-medium text-white transition-colors hover:bg-emerald-500"
              >
                Update profile
              </button>
            </div>

            <div>
              <p className="text-[14px] font-semibold text-slate-100">Profile picture</p>
              <ProfilePictureEditor
                name={session.displayName}
                initialAvatarUrl={session.avatarUrl}
              />
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
