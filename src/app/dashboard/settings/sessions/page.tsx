import Link from "next/link";
import { redirect } from "next/navigation";
import { getSessionToken, resolveSession } from "@/lib/auth/session";
import { listSessionsForAccount, type SessionSummaryDto } from "@/modules/sessions/service";
import { SettingsScaffold } from "./SettingsScaffold";

function WebSessionDeviceIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" className="h-[44px] w-[44px]" fill="none">
      <path
        d="M3.75 5.5h16.5a1.75 1.75 0 0 1 1.75 1.75v10.5a1.75 1.75 0 0 1-1.75 1.75H3.75A1.75 1.75 0 0 1 2 17.75V7.25A1.75 1.75 0 0 1 3.75 5.5Z"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.6"
      />
      <path
        d="M8 22h8m-4-2.5V22m-2.7-2.5h5.4"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.6"
      />
    </svg>
  );
}

function normalizeIpForDisplay(ipAddress: string | null): string | null {
  if (!ipAddress) return null;
  const trimmed = ipAddress.trim();
  if (!trimmed) return null;
  return trimmed.toLowerCase().startsWith("::ffff:") ? trimmed.slice(7) : trimmed;
}

function isLocalIp(ipAddress: string | null): boolean {
  const normalized = normalizeIpForDisplay(ipAddress)?.toLowerCase();
  if (!normalized) return false;
  if (normalized === "::1" || normalized === "localhost") return true;
  if (normalized === "127.0.0.1") return true;
  if (normalized.startsWith("127.")) return true;
  return false;
}

function formatLocation(value: SessionSummaryDto): string {
  const parts = [value.location.city, value.location.region, value.location.country].filter(
    (item): item is string => typeof item === "string" && item.length > 0
  );
  const hasCoordinates =
    typeof value.location.latitude === "number" && typeof value.location.longitude === "number";

  if (parts.length === 0) {
    if (hasCoordinates) {
      const latitude = value.location.latitude as number;
      const longitude = value.location.longitude as number;
      return `Lat ${latitude.toFixed(4)}, Lon ${longitude.toFixed(4)}`;
    }
    if (isLocalIp(value.ipAddress)) {
      return "Localhost (development)";
    }
    return "Location unavailable";
  }

  return parts.join(", ");
}

function formatSessionTitle(value: SessionSummaryDto): string {
  const hasCoordinates =
    typeof value.location.latitude === "number" && typeof value.location.longitude === "number";
  const locationPart =
    value.location.city ??
    value.location.country ??
    (hasCoordinates ? "Precise location" : isLocalIp(value.ipAddress) ? "Localhost" : "Unknown location");
  const ipPart = normalizeIpForDisplay(value.ipAddress) ?? "IP unavailable";
  return `${locationPart} ${ipPart}`;
}

function formatSeenIn(value: SessionSummaryDto): string {
  if (value.location.countryCode) {
    return `Seen in ${value.location.countryCode}`;
  }
  if (value.location.country) {
    return `Seen in ${value.location.country}`;
  }
  if (typeof value.location.latitude === "number" && typeof value.location.longitude === "number") {
    return "Seen with precise coordinates";
  }
  if (isLocalIp(value.ipAddress)) {
    return "Seen on localhost";
  }
  return "Seen location unavailable";
}

function formatDateTime(value: Date): string {
  return value.toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default async function DashboardSessionsSettingsPage() {
  const session = await resolveSession();
  if (!session) {
    redirect("/sign-in");
  }

  const currentToken = await getSessionToken();
  const sessions = await listSessionsForAccount(session.id, currentToken);

  return (
    <SettingsScaffold displayName={session.displayName} avatarUrl={session.avatarUrl}>
      <h2 className="text-[24px] font-semibold leading-none text-slate-100">Web sessions</h2>
      <div className="mt-[14px] border-t border-slate-800/90" />

      <p className="pt-[20px] text-[15px] leading-[26px] text-slate-100">
        This is a list of devices that have logged into your account. Revoke any sessions that you do not
        recognize.
      </p>

      {sessions.length === 0 ? (
        <div className="mt-[20px] rounded-[12px] border border-slate-700/80 bg-slate-900/60 px-[24px] py-[22px]">
          <p className="text-[15px] text-slate-300">No active sessions found.</p>
        </div>
      ) : (
        <div className="mt-[20px] space-y-[14px]">
          {sessions.map((item) => (
            <div
              key={item.id}
              className="rounded-[12px] border border-slate-700/80 bg-slate-900/60 px-[24px] py-[22px]"
            >
              <div className="flex flex-col gap-[24px] lg:flex-row lg:items-center lg:justify-between">
                <div className="flex items-start gap-[22px]">
                  <span className="text-slate-400">
                    <WebSessionDeviceIcon />
                  </span>
                  <div className="min-w-0">
                    <p className="truncate text-[18px] font-semibold leading-none text-slate-300">
                      {formatSessionTitle(item)}
                    </p>
                    <p className="flex items-center gap-[8px] pt-[12px] text-[14px] leading-none text-slate-300">
                      <span
                        className={`inline-block h-[10px] w-[10px] rounded-full ${
                          item.isCurrent ? "bg-green-500" : "bg-slate-500"
                        }`}
                      />
                      {item.isCurrent ? "active" : "recent"}
                    </p>
                    <p className="pt-[10px] text-[15px] leading-none text-slate-300">
                      {item.isCurrent ? "Your current session" : item.deviceLabel}
                    </p>
                    <p className="pt-[10px] text-[15px] leading-none text-slate-400">{formatSeenIn(item)}</p>
                    <p className="pt-[10px] text-[13px] leading-none text-slate-500">
                      Last seen: {formatDateTime(item.lastSeenAt)}
                    </p>
                    <p className="pt-[8px] text-[13px] leading-none text-slate-500">{formatLocation(item)}</p>
                  </div>
                </div>

                <Link
                  href={`/dashboard/settings/sessions/${item.id}`}
                  className="inline-flex h-[40px] w-fit items-center justify-center self-start rounded-[10px] border border-slate-600/90 bg-slate-800/70 px-[16px] text-[14px] font-medium leading-none text-slate-100 transition-colors hover:bg-slate-700/75 lg:self-center"
                >
                  Details
                </Link>
              </div>
            </div>
          ))}
        </div>
      )}
    </SettingsScaffold>
  );
}
