import type { ArchiveEmail } from "@/lib/server/types";

import AttachmentChip from "./AttachmentChip";
import LocalDateTime from "./LocalDateTime";
import MarkdownContent from "./MarkdownContent";

type EmailCardProps = {
  entry: ArchiveEmail;
  sharedGrantId?: string;
  isLast?: boolean;
  preloadAttachments?: boolean;
};

export default function EmailCard({ entry, sharedGrantId, isLast = false, preloadAttachments }: EmailCardProps) {
  return (
    <article className="grid min-w-0 grid-cols-[1.25rem_minmax(0,1fr)] gap-x-3 md:grid-cols-[7.5rem_1.5rem_minmax(0,1fr)] md:gap-x-4">
      <div className="col-span-2 mb-2 md:col-span-1 md:mb-0 md:pt-0.5 md:text-right">
        <LocalDateTime
          className="text-sm font-semibold text-[var(--ink)] md:hidden"
          date={entry.date}
        />
        <LocalDateTime
          className="hidden text-sm font-semibold leading-5 text-[var(--ink)] md:inline"
          date={entry.date}
        />
      </div>

      <div className="relative flex justify-center md:col-start-2">
        <span className="relative z-10 mt-1 block size-3.5 rounded-full border-2 border-[var(--accent)] bg-[var(--surface)]" />
        {!isLast ? (
          <span className="absolute bottom-[-2rem] top-4 w-px bg-[var(--accent)]/55" aria-hidden="true" />
        ) : null}
      </div>

      <div className="min-w-0 rounded-xl border border-[var(--line)] bg-[var(--surface)] p-4 shadow-[var(--card-shadow)] sm:p-6 md:col-start-3">
        <header className="border-b border-[var(--line)] pb-4">
          <dl className="grid min-w-0 grid-cols-[3.25rem_minmax(0,1fr)] gap-x-3 gap-y-1.5 text-sm leading-5">
            <dt className="font-semibold text-[var(--ink)]">From</dt>
            <dd className="min-w-0 break-words text-[var(--muted)]">{entry.from}</dd>
            <dt className="font-semibold text-[var(--ink)]">To</dt>
            <dd className="min-w-0 break-words text-[var(--muted)]">{entry.to.join(", ")}</dd>
            {entry.cc && entry.cc.length > 0 ? (
              <>
                <dt className="font-semibold text-[var(--ink)]">CC</dt>
                <dd className="min-w-0 break-words text-[var(--muted)]">{entry.cc.join(", ")}</dd>
              </>
            ) : null}
            <dt className="font-semibold text-[var(--ink)]">Subject</dt>
            <dd className="min-w-0 break-words font-medium text-[var(--ink)]">
              {entry.subject}
            </dd>
          </dl>
        </header>

        <div className="pt-5">
          <MarkdownContent>{entry.body}</MarkdownContent>
        </div>

        {entry.attachments.length > 0 ? (
          <footer className="mt-6 border-t border-[var(--line)] pt-4">
            <h3 className="mb-3 text-xs font-semibold uppercase tracking-[0.08em] text-[var(--muted)]">
              Attachments ({entry.attachments.length})
            </h3>
            <div className="space-y-2.5">
              {entry.attachments.map((attachment) => (
                <AttachmentChip
                  key={attachment.file}
                  attachment={attachment}
                  chainSlug={entry.chain}
                  sharedGrantId={sharedGrantId}
                  preload={preloadAttachments}
                />
              ))}
            </div>
          </footer>
        ) : null}
      </div>
    </article>
  );
}
