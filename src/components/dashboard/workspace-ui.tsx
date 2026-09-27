import Link from "next/link";
import type { ReactNode } from "react";

type Tone = "neutral" | "blue" | "green" | "red" | "violet";

const toneClasses: Record<Tone, string> = {
  neutral: "border-slate-700/70 bg-slate-900/58 text-slate-200",
  blue: "border-[color:var(--color-blue-500)]/35 bg-[color:var(--color-blue-500)]/10 text-[color:var(--color-blue-200)]",
  green: "border-emerald-500/35 bg-emerald-500/10 text-emerald-200",
  red: "border-red-500/35 bg-red-500/10 text-red-200",
  violet: "border-violet-500/35 bg-violet-500/10 text-[color:var(--workspace-accent-text)]",
};

export function WorkspacePage({
  children,
  maxWidth = "max-w-7xl",
}: {
  children: ReactNode;
  maxWidth?: string;
}) {
  return (
    <main className={`mx-auto w-full ${maxWidth} space-y-6 px-4 py-5 sm:px-6 lg:px-8`}>
      {children}
    </main>
  );
}

export function PageHero({
  title,
  description,
  actions,
  meta,
}: {
  title: string;
  description?: string;
  actions?: ReactNode;
  meta?: ReactNode;
}) {
  return (
    <header className="flex flex-col gap-3 border-b border-[color:var(--workspace-rule)] pb-4 sm:flex-row sm:items-center sm:justify-between">
      <div className="min-w-0">
          <h1 className="!font-sans text-2xl font-semibold leading-tight text-[color:var(--workspace-ink)] sm:text-3xl">
              {title}
          </h1>
            {description ? (
              <p className="mt-1 max-w-2xl text-sm leading-5 text-[color:var(--workspace-muted)]">
                {description}
              </p>
            ) : null}
          {meta ? <div className="mt-2 flex flex-wrap gap-2">{meta}</div> : null}
      </div>
        {actions ? <div className="flex shrink-0 flex-wrap gap-2">{actions}</div> : null}
    </header>
  );
}

export function SectionPanel({
  title,
  description,
  actions,
  children,
  className = "",
}: {
  title?: string;
  description?: string;
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section
      className={`border-b border-[color:var(--workspace-rule)] pb-5 ${className}`}
    >
      {title || description || actions ? (
        <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            {title ? <h2 className="text-base font-semibold text-slate-100">{title}</h2> : null}
            {description ? (
              <p className="mt-1 max-w-2xl text-sm leading-6 text-slate-400">{description}</p>
            ) : null}
          </div>
          {actions ? <div className="flex shrink-0 flex-wrap gap-2">{actions}</div> : null}
        </div>
      ) : null}
      {children}
    </section>
  );
}

export function MetricGrid({ children }: { children: ReactNode }) {
  return <div className="grid grid-cols-2 gap-3 lg:grid-cols-3 xl:grid-cols-6">{children}</div>;
}

export function MetricCard({
  label,
  value,
  hint,
}: {
  label: string;
  value: ReactNode;
  hint?: string;
}) {
  return (
    <div className="rounded-lg border border-slate-800/85 bg-slate-950/38 p-4">
      <p className="font-mono text-2xl font-semibold tabular-nums text-slate-50">{value}</p>
      <p className="mt-1 text-xs font-medium text-slate-400">{label}</p>
      {hint ? <p className="mt-2 text-xs leading-5 text-slate-500">{hint}</p> : null}
    </div>
  );
}

export function ActionGrid({ children }: { children: ReactNode }) {
  return <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">{children}</div>;
}

export function ActionCard({
  href,
  label,
  description,
}: {
  href: string;
  label: string;
  description: string;
}) {
  return (
    <Link
      href={href}
      className="group flex min-h-24 flex-col justify-between border border-[color:var(--workspace-rule)] p-3 transition-colors duration-150 hover:border-[color:var(--color-blue-400)]/55 hover:bg-[color:var(--workspace-accent-soft)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--color-blue-400)]"
    >
      <span className="text-sm font-semibold text-slate-100">{label}</span>
      <span className="mt-3 text-sm leading-5 text-slate-400">{description}</span>
    </Link>
  );
}

export function StatusBadge({
  children,
  tone = "neutral",
}: {
  children: ReactNode;
  tone?: Tone;
}) {
  return (
    <span
      className={`inline-flex items-center rounded border px-2 py-1 text-xs font-semibold ${toneClasses[tone]}`}
    >
      {children}
    </span>
  );
}

export function EmptyState({
  title,
  description,
  action,
}: {
  title: string;
  description: string;
  action?: ReactNode;
}) {
  return (
    <div className="border-y border-dashed border-[color:var(--workspace-rule)] py-7 text-center">
      <p className="text-base font-semibold text-slate-100">{title}</p>
      <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-slate-400">{description}</p>
      {action ? <div className="mt-5 flex justify-center">{action}</div> : null}
    </div>
  );
}

export function ErrorState({
  message,
  action,
}: {
  message: string;
  action?: ReactNode;
}) {
  return (
    <div className="rounded-lg border border-red-500/35 bg-red-500/10 p-4 text-sm text-red-100" aria-live="polite">
      <p>{message}</p>
      {action ? <div className="mt-3">{action}</div> : null}
    </div>
  );
}

export function SkeletonRows({ rows = 4 }: { rows?: number }) {
  return (
    <div className="space-y-3" aria-label="Loading content">
      {Array.from({ length: rows }).map((_, index) => (
        <div
          key={index}
          className="rounded-lg border border-slate-800/70 bg-slate-950/35 p-4"
        >
          <div className="h-4 w-2/5 animate-pulse rounded bg-slate-700/70" />
          <div className="mt-3 h-3 w-4/5 animate-pulse rounded bg-slate-800/80" />
          <div className="mt-2 h-3 w-3/5 animate-pulse rounded bg-slate-800/70" />
        </div>
      ))}
    </div>
  );
}

export function primaryButtonClass() {
  return "inline-flex min-h-10 items-center justify-center rounded-md bg-[color:var(--color-blue-600)] px-4 py-2 text-sm font-semibold text-white transition-colors duration-200 hover:bg-[color:var(--color-blue-500)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--color-blue-400)] disabled:pointer-events-none disabled:opacity-50";
}

export function secondaryButtonClass() {
  return "inline-flex min-h-10 items-center justify-center rounded-md border border-slate-700 bg-slate-950/30 px-4 py-2 text-sm font-semibold text-slate-200 transition-[background-color,border-color] duration-200 hover:border-[color:var(--color-blue-500)]/55 hover:bg-slate-900 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--color-blue-400)] disabled:pointer-events-none disabled:opacity-50";
}

export function dangerButtonClass() {
  return "inline-flex min-h-9 items-center justify-center rounded-md border border-red-400/45 bg-red-500/10 px-3 py-1.5 text-sm font-semibold text-red-200 transition-[background-color,border-color] duration-200 hover:border-red-300 hover:bg-red-500/18 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-300 disabled:pointer-events-none disabled:opacity-50";
}
