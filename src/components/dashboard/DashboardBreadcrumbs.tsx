import Link from "next/link";

export interface DashboardBreadcrumbItem {
  href?: string;
  label: string;
}

interface DashboardBreadcrumbsProps {
  items: DashboardBreadcrumbItem[];
}

export function DashboardBreadcrumbs({ items }: DashboardBreadcrumbsProps) {
  if (items.length === 0) return null;

  return (
    <nav className="flex items-center gap-2 text-sm text-slate-500" aria-label="Breadcrumb">
      {items.map((item, index) => {
        const isLast = index === items.length - 1;
        return (
          <span key={`${item.label}-${index}`} className="flex items-center gap-2">
            {item.href && !isLast ? (
              <Link href={item.href} className="hover:text-slate-300">
                {item.label}
              </Link>
            ) : (
              <span className={isLast ? "text-slate-200" : undefined}>{item.label}</span>
            )}
            {!isLast ? <span aria-hidden="true">/</span> : null}
          </span>
        );
      })}
    </nav>
  );
}
