import Link from "next/link";

type ExppBrandVariant = "auth" | "header";

interface ExppBrandProps {
  href?: string;
  variant?: ExppBrandVariant;
  className?: string;
}

function classNames(...parts: Array<string | undefined>) {
  return parts.filter(Boolean).join(" ");
}

function ExppBrandContent({ variant }: { variant: ExppBrandVariant }) {
  const iconBoxClassName =
    variant === "auth"
      ? "flex h-10 w-10 shrink-0 items-center justify-center rounded-[12px] bg-blue-600 sm:h-12 sm:w-12 sm:rounded-[14px]"
      : "flex h-8 w-8 shrink-0 items-center justify-center rounded-[10px] bg-blue-600";

  const iconClassName =
    variant === "auth" ? "h-6 w-6 text-white sm:h-[30px] sm:w-[30px]" : "h-[18px] w-[18px] text-white";

  const textClassName =
    variant === "auth"
      ? "hidden bg-gradient-to-r from-blue-600 to-blue-400 bg-clip-text text-[32px] font-bold leading-none tracking-[0.5px] text-transparent sm:inline"
      : "bg-gradient-to-r from-blue-600 to-blue-400 bg-clip-text text-[18px] font-semibold leading-none tracking-[0.2px] text-transparent";

  return (
    <>
      <span className={iconBoxClassName}>
        <svg
          className={iconClassName}
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.6"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <path d="M22 10v6" />
          <path d="M2 10l10-5 10 5-10 5Z" />
          <path d="M6 12v5c3 3 9 3 12 0v-5" />
        </svg>
      </span>
      <span className={textClassName}>EXPP</span>
    </>
  );
}

export function ExppBrand({ href, variant = "header", className }: ExppBrandProps) {
  const rootClassName = classNames(
    "inline-flex items-center no-underline",
    variant === "auth" ? "gap-3 transition-transform duration-200 hover:scale-105" : "gap-2.5",
    className
  );

  if (href) {
    return (
      <Link href={href} className={rootClassName} aria-label="EXPP">
        <ExppBrandContent variant={variant} />
      </Link>
    );
  }

  return (
    <div className={rootClassName} aria-label="EXPP">
      <ExppBrandContent variant={variant} />
    </div>
  );
}
