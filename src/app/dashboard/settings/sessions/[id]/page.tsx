import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getSessionToken, resolveSession } from "@/lib/auth/session";
import { NotFoundError } from "@/lib/errors";
import { getSessionDetailForAccount } from "@/modules/sessions/service";
import { SettingsScaffold } from "../SettingsScaffold";
import SessionLocationMap from "./SessionLocationMap";

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

function formatLocation(opts: {
  city: string | null;
  region: string | null;
  country: string | null;
  latitude: number | null;
  longitude: number | null;
  ipAddress: string | null;
}): string {
  const parts = [opts.city, opts.region, opts.country].filter(
    (item): item is string => typeof item === "string" && item.length > 0
  );
  const hasCoordinates =
    typeof opts.latitude === "number" && typeof opts.longitude === "number";

  if (parts.length === 0) {
    if (hasCoordinates) {
      const latitude = opts.latitude as number;
      const longitude = opts.longitude as number;
      return `Lat ${latitude.toFixed(4)}, Lon ${longitude.toFixed(4)}`;
    }
    if (isLocalIp(opts.ipAddress)) {
      return "Localhost (development)";
    }
    return "Location unavailable";
  }

  return parts.join(", ");
}

function formatSeenIn(opts: {
  countryCode: string | null;
  country: string | null;
  latitude: number | null;
  longitude: number | null;
  ipAddress: string | null;
}): string {
  if (opts.countryCode) {
    return `Seen in ${opts.countryCode}`;
  }
  if (opts.country) {
    return `Seen in ${opts.country}`;
  }
  if (typeof opts.latitude === "number" && typeof opts.longitude === "number") {
    return "Seen with precise coordinates";
  }
  if (isLocalIp(opts.ipAddress)) {
    return "Seen on localhost";
  }
  return "Seen location unavailable";
}

function formatSignedInDate(value: Date): string {
  return value.toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

type Props = {
  params: Promise<{ id: string }>;
};

export default async function DashboardSessionDetailsPage({ params }: Props) {
  const { id } = await params;

  const session = await resolveSession();
  if (!session) {
    redirect("/sign-in");
  }

  const currentToken = await getSessionToken();

  let details;
  try {
    details = await getSessionDetailForAccount({
      sessionId: id,
      accountId: session.id,
      currentToken,
    });
  } catch (error) {
    if (error instanceof NotFoundError) {
      notFound();
    }
    throw error;
  }

  const hasCoordinates =
    typeof details.location.latitude === "number" &&
    typeof details.location.longitude === "number";

  const locationLabel = formatLocation({
    city: details.location.city,
    region: details.location.region,
    country: details.location.country,
    latitude: details.location.latitude,
    longitude: details.location.longitude,
    ipAddress: details.ipAddress,
  });

  return (
    <SettingsScaffold displayName={session.displayName} avatarUrl={session.avatarUrl}>
      <div className="flex items-center justify-between gap-[12px]">
        <h2 className="text-[24px] font-semibold leading-none text-slate-100">Session details</h2>
        <Link
          href="/dashboard/settings/sessions"
          className="inline-flex h-[36px] items-center justify-center rounded-[10px] border border-slate-700 bg-slate-900/70 px-[14px] text-[13px] font-medium text-slate-200 transition-colors hover:bg-slate-800"
        >
          Back
        </Link>
      </div>
      <div className="mt-[14px] border-t border-slate-800/90" />

      <div className="mt-[20px] rounded-[12px] border border-slate-700/80 bg-slate-900/60 px-[24px] py-[22px]">
        <div className="flex items-start gap-[22px]">
          <span className="text-slate-400">
            <WebSessionDeviceIcon />
          </span>
          <div className="min-w-0">
            <p className="truncate text-[20px] font-semibold leading-none text-slate-300">
              {(details.location.city ??
                details.location.country ??
                (isLocalIp(details.ipAddress) ? "Localhost" : "Unknown location")) +
                " " +
                (normalizeIpForDisplay(details.ipAddress) ?? "IP unavailable")}
            </p>
            <p className="pt-[10px] text-[15px] leading-none text-slate-300">
              {details.isCurrent ? "Your current session" : "Session on this account"}
            </p>
            <p className="pt-[10px] text-[15px] leading-none text-slate-400">
              {formatSeenIn({
                countryCode: details.location.countryCode,
                country: details.location.country,
                latitude: details.location.latitude,
                longitude: details.location.longitude,
                ipAddress: details.ipAddress,
              })}
            </p>
          </div>
        </div>

        <div className="mt-[20px] space-y-[18px] text-slate-300">
          <div>
            <p className="text-[18px] font-semibold leading-none text-slate-100">Device:</p>
            <p className="pt-[8px] text-[16px] leading-none">{details.deviceLabel}</p>
          </div>

          <div>
            <p className="text-[18px] font-semibold leading-none text-slate-100">Last location:</p>
            <p className="pt-[8px] text-[16px] leading-none">{locationLabel}</p>
          </div>

          <div>
            <p className="text-[18px] font-semibold leading-none text-slate-100">Signed in:</p>
            <p className="pt-[8px] text-[16px] leading-none">{formatSignedInDate(details.createdAt)}</p>
            <p className="pt-[8px] text-[16px] leading-none text-slate-400">{locationLabel}</p>
          </div>
        </div>

        <div className="mt-[24px]">
          {!hasCoordinates && (
            <p className="mb-[10px] text-[14px] text-slate-300">
              Location unavailable for this session. Allow browser location access to improve accuracy.
            </p>
          )}
          <SessionLocationMap
            latitude={details.location.latitude}
            longitude={details.location.longitude}
          />
        </div>
      </div>
    </SettingsScaffold>
  );
}
