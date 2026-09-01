import Link from "next/link";

import { ArrowRightIcon, DocumentIcon } from "./Icons";

type OrganizationCardProps = {
  href: string;
  title: string;
  description?: string;
  chainCount: number;
  categoryCount?: number;
  actionLabel: string;
  nativeNavigation?: boolean;
};

export default function OrganizationCard({
  href,
  title,
  description,
  chainCount,
  categoryCount,
  actionLabel,
  nativeNavigation = false,
}: OrganizationCardProps) {
  return (
    <article className="group relative border-t border-[var(--line)] py-7 first:border-t-0 sm:py-8">
      <div className="grid gap-5 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center">
        <div className="min-w-0">
          <h2 className="text-xl font-semibold tracking-[-0.025em] text-[var(--ink)] sm:text-2xl">
            {nativeNavigation ? <a
              href={href}
              className="rounded-sm outline-none after:absolute after:inset-0 focus-visible:ring-2 focus-visible:ring-[var(--accent)] focus-visible:ring-offset-4"
            >{title}</a> : <Link
              href={href}
              className="rounded-sm outline-none after:absolute after:inset-0 focus-visible:ring-2 focus-visible:ring-[var(--accent)] focus-visible:ring-offset-4"
            >{title}</Link>}
          </h2>
          {description ? (
            <p className="mt-2 max-w-3xl text-sm leading-6 text-[var(--muted)] sm:text-base sm:leading-7">
              {description}
            </p>
          ) : null}
          <div className="mt-4 flex flex-wrap gap-x-5 gap-y-2 text-sm text-[var(--muted)]">
            <span className="inline-flex items-center gap-2">
              <DocumentIcon className="size-4" />
              {chainCount} {chainCount === 1 ? "chain" : "chains"}
            </span>
            {categoryCount !== undefined ? (
              <span>
                {categoryCount} {categoryCount === 1 ? "category" : "categories"}
              </span>
            ) : null}
          </div>
        </div>
        <span className="inline-flex min-h-11 items-center gap-2 self-start text-sm font-semibold text-[var(--accent-strong)] sm:self-center">
          {actionLabel}
          <ArrowRightIcon className="size-4 transition-transform group-hover:translate-x-0.5" />
        </span>
      </div>
    </article>
  );
}
