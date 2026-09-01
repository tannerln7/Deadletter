import Link from "next/link";

import { ArchiveIcon } from "./Icons";

type EmptyStateProps = {
  actionHref?: string;
  actionLabel?: string;
  description: string;
  title: string;
};

export default function EmptyState({
  actionHref,
  actionLabel,
  description,
  title,
}: EmptyStateProps) {
  return (
    <div className="flex min-h-64 flex-col items-center justify-center border-y border-dashed border-[var(--line-strong)] px-5 py-14 text-center">
      <span className="grid size-11 place-items-center rounded-full bg-[var(--accent-soft)] text-[var(--accent-strong)]">
        <ArchiveIcon className="size-5" />
      </span>
      <h2 className="mt-4 text-xl font-semibold tracking-[-0.02em] text-[var(--ink)]">
        {title}
      </h2>
      <p className="mt-2 max-w-xl text-sm leading-6 text-[var(--muted)]">
        {description}
      </p>
      {actionHref && actionLabel ? (
        <Link
          href={actionHref}
          className="mt-5 inline-flex min-h-11 items-center rounded-md border border-[var(--line-strong)] px-4 text-sm font-semibold text-[var(--ink)] outline-none hover:border-[var(--accent)] hover:text-[var(--accent-strong)] focus-visible:ring-2 focus-visible:ring-[var(--accent)] focus-visible:ring-offset-2"
        >
          {actionLabel}
        </Link>
      ) : null}
    </div>
  );
}
