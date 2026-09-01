import Link from "next/link";

import type {
  ArchiveChainSummary,
  ArchiveEmail,
  ChainManifest,
} from "@/lib/server/types";

import EmailCard from "./EmailCard";
import EmptyState from "./EmptyState";
import { CalendarIcon, DocumentIcon, PaperclipIcon } from "./Icons";
import LocalDateTime from "./LocalDateTime";
import { PreviewCacheProvider } from "./PreviewCacheProvider";

type EmailChainViewerProps = {
  entries: readonly ArchiveEmail[];
  manifest: ChainManifest;
  sortOrder?: ChainSortOrder;
  summary: ArchiveChainSummary;
  sharedGrantId?: string;
};

export type ChainSortOrder = "oldest" | "newest";

export function normalizeChainSortOrder(
  value: string | string[] | undefined,
): ChainSortOrder {
  return value === "newest" ? "newest" : "oldest";
}

export function orderChainEntries(
  entries: readonly ArchiveEmail[],
  sortOrder: ChainSortOrder,
): readonly ArchiveEmail[] {
  return sortOrder === "newest" ? [...entries].reverse() : entries;
}

export default function EmailChainViewer({
  entries,
  manifest,
  sortOrder = "oldest",
  summary,
  sharedGrantId,
}: EmailChainViewerProps) {
  const displayEntries = orderChainEntries(entries, sortOrder);
  const chainPath = sharedGrantId
    ? `/shared/${encodeURIComponent(sharedGrantId)}/chains/${encodeURIComponent(manifest.slug)}`
    : `/chains/${encodeURIComponent(manifest.slug)}`;
  const homePath = sharedGrantId ? `/shared/${encodeURIComponent(sharedGrantId)}` : "/";

  return (
    <section aria-labelledby="chain-heading">
      <header className="border-b border-[var(--line)] pb-8 sm:pb-10">
        {sharedGrantId ? <a
          href={homePath}
          className="inline-flex min-h-11 items-center rounded-sm text-sm font-semibold text-[var(--accent-strong)] outline-none hover:underline hover:decoration-[var(--accent)] hover:underline-offset-4 focus-visible:ring-2 focus-visible:ring-[var(--accent)] focus-visible:ring-offset-2"
        >
          ← All chains
        </a> : <Link
          href={homePath}
          className="inline-flex min-h-11 items-center rounded-sm text-sm font-semibold text-[var(--accent-strong)] outline-none hover:underline hover:decoration-[var(--accent)] hover:underline-offset-4 focus-visible:ring-2 focus-visible:ring-[var(--accent)] focus-visible:ring-offset-2"
        >← All chains</Link>}
        <h1
          id="chain-heading"
          className="mt-2 max-w-4xl break-words text-3xl font-semibold tracking-[-0.04em] text-[var(--ink)] sm:text-4xl"
        >
          {manifest.title}
        </h1>
        {manifest.description ? (
          <p className="mt-3 max-w-3xl text-base leading-7 text-[var(--muted)]">
            {manifest.description}
          </p>
        ) : null}
        <div className="mt-5 flex flex-wrap items-end justify-between gap-x-6 gap-y-4">
          <div className="flex flex-wrap gap-x-5 gap-y-2 text-sm text-[var(--muted)]">
            <span className="inline-flex items-center gap-2">
              <DocumentIcon className="size-4" />
              {summary.entryCount} {summary.entryCount === 1 ? "entry" : "entries"}
            </span>
            <span className="inline-flex items-center gap-2">
              <PaperclipIcon className="size-4" />
              {summary.attachmentCount}{" "}
              {summary.attachmentCount === 1 ? "attachment" : "attachments"}
            </span>
            {summary.earliestDate && summary.latestDate ? (
              <span className="inline-flex items-center gap-2">
                <CalendarIcon className="size-4" />
                <LocalDateTime date={summary.earliestDate} includeTime={false} />
                <span aria-hidden="true">—</span>
                <LocalDateTime date={summary.latestDate} includeTime={false} />
              </span>
            ) : null}
          </div>
          <div
            aria-label="Timeline order"
            className="inline-flex rounded-lg border border-[var(--line-strong)] bg-[var(--surface)] p-1 text-sm font-semibold"
            role="group"
          >
            {sharedGrantId ? <a
              href={chainPath}
              aria-current={sortOrder === "oldest" ? "page" : undefined}
              className={`inline-flex min-h-11 items-center rounded-md px-3 outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] focus-visible:ring-offset-2 ${sortOrder === "oldest" ? "bg-[var(--control-active)] text-[var(--control-active-ink)]" : "text-[var(--muted)] hover:text-[var(--ink)]"}`}
            >Oldest first</a> : <Link
              href={chainPath}
              aria-current={sortOrder === "oldest" ? "page" : undefined}
              className={`inline-flex min-h-11 items-center rounded-md px-3 outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] focus-visible:ring-offset-2 ${
                sortOrder === "oldest"
                  ? "bg-[var(--control-active)] text-[var(--control-active-ink)]"
                  : "text-[var(--muted)] hover:text-[var(--ink)]"
              }`}
            >Oldest first</Link>}
            {sharedGrantId ? <a
              href={`${chainPath}?sort=newest`}
              aria-current={sortOrder === "newest" ? "page" : undefined}
              className={`inline-flex min-h-11 items-center rounded-md px-3 outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] focus-visible:ring-offset-2 ${sortOrder === "newest" ? "bg-[var(--control-active)] text-[var(--control-active-ink)]" : "text-[var(--muted)] hover:text-[var(--ink)]"}`}
            >Newest first</a> : <Link
              href={`${chainPath}?sort=newest`}
              aria-current={sortOrder === "newest" ? "page" : undefined}
              className={`inline-flex min-h-11 items-center rounded-md px-3 outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] focus-visible:ring-offset-2 ${
                sortOrder === "newest"
                  ? "bg-[var(--control-active)] text-[var(--control-active-ink)]"
                  : "text-[var(--muted)] hover:text-[var(--ink)]"
              }`}
            >Newest first</Link>}
          </div>
        </div>
      </header>

      {entries.length > 0 ? (
        <PreviewCacheProvider>
          <div className="space-y-8 py-8 sm:py-10">
            {displayEntries.map((entry, index) => (
              <EmailCard
                key={entry.id}
                entry={entry}
                sharedGrantId={sharedGrantId}
                isLast={index === displayEntries.length - 1}
              />
            ))}
          </div>
        </PreviewCacheProvider>
      ) : (
        <div className="py-8">
          <EmptyState
            title="No entries yet"
            description={`Add Markdown files to the emails/ directory inside “${manifest.slug}”, then refresh this page.`}
          />
        </div>
      )}
    </section>
  );
}
