import Link from "next/link";
import { redirect } from "next/navigation";
import { resolveSession } from "@/lib/auth/session";
import { UserAvatar } from "@/lib/ui/user-avatar";
import { ProfilePictureEditor } from "../settings/ProfilePictureEditor";

const PROFILE_FONT_STACK =
  '-apple-system, BlinkMacSystemFont, "Segoe UI", Helvetica, Arial, sans-serif';

function PublicProfileIcon() {
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

export default async function DashboardProfilePage() {
  const session = await resolveSession();
  if (!session) {
    redirect("/login");
  }
  if (session.domain !== "GLOBAL") {
    redirect("/");
  }

  return (
    <main
      className="min-h-screen bg-slate-950 text-slate-100"
      style={{ fontFamily: PROFILE_FONT_STACK }}
    >
      <header className="border-b border-slate-800/90 bg-slate-950/90">
        <div className="mx-auto flex h-[64px] max-w-[1320px] items-center px-[16px] lg:px-[24px]">
          <h1 className="text-[14px] font-semibold tracking-[-0.01em] text-slate-100">Profile</h1>
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
            href="/dashboard/settings/account"
            className="inline-flex h-[40px] items-center justify-center rounded-[10px] border border-slate-700 bg-slate-800/70 px-[16px] text-[14px] font-medium text-slate-100 transition-colors hover:bg-slate-700/70"
          >
            Go to account settings
          </Link>
        </div>

        <div className="grid gap-[24px] lg:grid-cols-[320px_1fr]">
          <aside className="border-b border-slate-800 pb-[20px] lg:border-b-0 lg:border-r lg:pr-[24px]">
            <nav className="space-y-[4px]">
              <Link
                href="/dashboard/profile"
                className="flex h-[44px] w-full items-center gap-[10px] rounded-[10px] bg-slate-800/80 px-[12px] text-left text-[14px] font-semibold text-slate-100"
              >
                <span className="text-slate-300">
                  <PublicProfileIcon />
                </span>
                <span>Public Profile</span>
              </Link>
            </nav>
          </aside>

          <section>
            <h2 className="text-[36px] font-semibold leading-none text-slate-100">Public profile</h2>
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
                  You can manage verified email addresses in your email settings.
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
                  All of the fields on this page are optional and can be deleted at any time, and by filling them
                  out, you&apos;re giving us consent to share this data wherever your user profile appears. Please see our{" "}
                  <Link href="/privacy" className="text-blue-400 underline underline-offset-4 hover:text-blue-300">
                    privacy statement
                  </Link>{" "}
                  to learn more about how we use this information.
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
      </div>
    </main>
  );
}
