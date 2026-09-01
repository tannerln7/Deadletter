import Link from "next/link";

import type { ArchiveChainSummary } from "@/lib/server/types";

import { ArrowRightIcon, CalendarIcon, DocumentIcon, PaperclipIcon } from "./Icons";
import LocalDateTime from "./LocalDateTime";

type ChainCardProps = {
  chain: ArchiveChainSummary;
  href?: string;
  nativeNavigation?: boolean;
};

export default function ChainCard({ chain, href, nativeNavigation = false }: ChainCardProps) {
  const hasDateRange = chain.earliestDate && chain.latestDate;

  return (
    <article className="group relative border-t border-[var(--line)] py-7 first:border-t-0 sm:py-8">
      <div className="grid gap-5 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center">
        <div className="min-w-0">
          <h2 className="text-xl font-semibold tracking-[-0.025em] text-[var(--ink)] sm:text-2xl">
            {nativeNavigation ? <a
              href={href ?? `/chains/${encodeURIComponent(chain.slug)}`}
              className="rounded-sm outline-none after:absolute after:inset-0 focus-visible:ring-2 focus-visible:ring-[var(--accent)] focus-visible:ring-offset-4"
            >
              {chain.title}
            </a> : <Link
              href={href ?? `/chains/${encodeURIComponent(chain.slug)}`}
              className="rounded-sm outline-none after:absolute after:inset-0 focus-visible:ring-2 focus-visible:ring-[var(--accent)] focus-visible:ring-offset-4"
            >{chain.title}</Link>}
          </h2>
          {chain.description ? (
            <p className="mt-2 max-w-3xl text-sm leading-6 text-[var(--muted)] sm:text-base sm:leading-7">
              {chain.description}
            </p>
          ) : null}
          <div className="mt-4 flex flex-wrap gap-x-5 gap-y-2 text-sm text-[var(--muted)]">
            <span className="inline-flex items-center gap-2">
              <DocumentIcon className="size-4" />
              {chain.entryCount} {chain.entryCount === 1 ? "entry" : "entries"}
            </span>
            <span className="inline-flex items-center gap-2">
              <PaperclipIcon className="size-4" />
              {chain.attachmentCount} {chain.attachmentCount === 1 ? "attachment" : "attachments"}
            </span>
            {hasDateRange ? (
              <span className="inline-flex min-w-0 items-center gap-2">
                <CalendarIcon className="size-4 shrink-0" />
                <span className="break-words">
                  <LocalDateTime date={chain.earliestDate!} includeTime={false} />
                  <span aria-hidden="true"> — </span>
                  <span className="sr-only"> through </span>
                  <LocalDateTime date={chain.latestDate!} includeTime={false} />
                </span>
              </span>
            ) : null}
          </div>
        </div>
        <span className="inline-flex min-h-11 items-center gap-2 self-start text-sm font-semibold text-[var(--accent-strong)] sm:self-center">
          Open chain
          <ArrowRightIcon className="size-4 transition-transform group-hover:translate-x-0.5" />
        </span>
      </div>
    </article>
  );
}
