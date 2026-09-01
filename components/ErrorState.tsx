import Link from "next/link";

import { WarningIcon } from "./Icons";

type ErrorStateProps = {
  backHref?: string;
  backLabel?: string;
  description: string;
  title: string;
};

export default function ErrorState({
  backHref = "/",
  backLabel = "Return to chains",
  description,
  title,
}: ErrorStateProps) {
  return (
    <div className="border-l-2 border-[var(--accent)] bg-[var(--accent-soft)] px-5 py-6 sm:px-6">
      <div className="flex gap-3">
        <WarningIcon className="mt-0.5 size-5 shrink-0 text-[var(--accent-strong)]" />
        <div className="min-w-0">
          <h2 className="font-semibold text-[var(--ink)]">{title}</h2>
          <p className="mt-1 text-sm leading-6 text-[var(--muted)]">{description}</p>
          <Link
            href={backHref}
            className="mt-4 inline-flex min-h-11 items-center text-sm font-semibold text-[var(--accent-strong)] underline decoration-[var(--accent)] underline-offset-4 outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] focus-visible:ring-offset-2"
          >
            {backLabel}
          </Link>
        </div>
      </div>
    </div>
  );
}
