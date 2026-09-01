import Link from "next/link";

type Breadcrumb = {
  href?: string;
  label: string;
};

export default function ArchiveBreadcrumbs({ items }: { items: readonly Breadcrumb[] }) {
  return (
    <nav aria-label="Breadcrumb" className="mb-6 text-sm text-[var(--muted)]">
      <ol className="flex flex-wrap items-center gap-x-2 gap-y-1">
        {items.map((item, index) => (
          <li key={`${item.href ?? "current"}:${item.label}`} className="inline-flex items-center gap-2">
            {index > 0 ? <span aria-hidden="true">/</span> : null}
            {item.href ? (
              <Link className="rounded-sm underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-[var(--accent)]" href={item.href}>
                {item.label}
              </Link>
            ) : (
              <span aria-current="page" className="text-[var(--ink)]">
                {item.label}
              </span>
            )}
          </li>
        ))}
      </ol>
    </nav>
  );
}
