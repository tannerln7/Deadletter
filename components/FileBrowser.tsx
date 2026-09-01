"use client";

import { useMemo, useState } from "react";

import { buildArchiveFileUrl } from "@/lib/archive-url";
import type {
  ArchiveFileCategory,
  ArchiveFileEntry,
} from "@/lib/server/types";

import EmptyState from "./EmptyState";
import FilePreviewModal, { type PreviewFile } from "./FilePreviewModal";
import {
  DocumentIcon,
  DownloadIcon,
  ExternalLinkIcon,
  EyeIcon,
  FileIcon,
  ImageIcon,
} from "./Icons";
import LocalDateTime from "./LocalDateTime";

type FileBrowserProps = {
  files: readonly ArchiveFileEntry[];
};

type CategoryFilter = "all" | ArchiveFileCategory;

const categories: { label: string; value: CategoryFilter }[] = [
  { label: "All", value: "all" },
  { label: "PDF", value: "pdf" },
  { label: "Images", value: "image" },
  { label: "Text", value: "text" },
  { label: "Office", value: "office" },
  { label: "Other", value: "other" },
];

function formatSize(size?: number): string {
  if (size === undefined) return "Size unavailable";
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
  return `${(size / (1024 * 1024)).toFixed(1)} MB`;
}

function FileTypeIcon({ category }: { category: ArchiveFileCategory }) {
  if (category === "image") return <ImageIcon className="size-5" />;
  if (category === "pdf" || category === "text") {
    return <DocumentIcon className="size-5" />;
  }
  return <FileIcon className="size-5" />;
}

function canPreview(file: ArchiveFileEntry): boolean {
  const type = file.type.split(";", 1)[0].toLowerCase();
  return (
    file.category === "pdf" ||
    (file.category === "image" && type !== "image/svg+xml") ||
    type === "text/plain" ||
    type === "text/markdown"
  );
}

export default function FileBrowser({ files }: FileBrowserProps) {
  const [chain, setChain] = useState("all");
  const [category, setCategory] = useState<CategoryFilter>("all");
  const [previewFile, setPreviewFile] = useState<PreviewFile | null>(null);

  const chains = useMemo(() => {
    const unique = new Map(files.map((file) => [file.chainSlug, file.chainTitle]));
    return [...unique.entries()].sort((left, right) => left[1].localeCompare(right[1]));
  }, [files]);

  const filteredFiles = useMemo(
    () =>
      files.filter(
        (file) =>
          (chain === "all" || file.chainSlug === chain) &&
          (category === "all" || file.category === category),
      ),
    [category, chain, files],
  );

  if (files.length === 0) {
    return (
      <EmptyState
        title="No attachments yet"
        description="Attachments referenced by valid email entries will appear here across every chain."
        actionHref="/"
        actionLabel="View chains"
      />
    );
  }

  return (
    <section aria-label="Archive files">
      <div className="grid gap-5 border-y border-[var(--line)] py-5 lg:grid-cols-[16rem_minmax(0,1fr)] lg:items-end">
        <label className="grid gap-2 text-sm font-semibold text-[var(--ink)]">
          Chain
          <select
            value={chain}
            onChange={(event) => setChain(event.target.value)}
            className="min-h-11 rounded-md border border-[var(--line-strong)] bg-[var(--surface)] px-3 font-normal text-[var(--ink)] outline-none focus:border-[var(--accent)] focus:ring-2 focus:ring-[var(--accent)]/30"
          >
            <option value="all">All chains</option>
            {chains.map(([slug, title]) => (
              <option key={slug} value={slug}>
                {title}
              </option>
            ))}
          </select>
        </label>

        <fieldset>
          <legend className="mb-2 text-sm font-semibold text-[var(--ink)]">File type</legend>
          <div className="flex flex-wrap gap-1.5" role="group">
            {categories.map((item) => (
              <button
                key={item.value}
                type="button"
                aria-pressed={category === item.value}
                onClick={() => setCategory(item.value)}
                className={`inline-flex min-h-11 items-center rounded-md border px-3 text-sm font-semibold outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] focus-visible:ring-offset-2 ${
                  category === item.value
                    ? "border-[var(--control-active)] bg-[var(--control-active)] text-[var(--control-active-ink)]"
                    : "border-[var(--line-strong)] bg-[var(--surface)] text-[var(--muted)] hover:border-[var(--accent)] hover:text-[var(--ink)]"
                }`}
              >
                {item.label}
              </button>
            ))}
          </div>
        </fieldset>
      </div>

      <div className="flex items-center justify-between border-b border-[var(--line)] py-4 text-sm text-[var(--muted)]">
        <p aria-live="polite">
          {filteredFiles.length} {filteredFiles.length === 1 ? "file" : "files"}
        </p>
        {(chain !== "all" || category !== "all") && (
          <button
            type="button"
            className="min-h-11 font-semibold text-[var(--accent-strong)] underline decoration-[var(--accent)] underline-offset-4"
            onClick={() => {
              setChain("all");
              setCategory("all");
            }}
          >
            Clear filters
          </button>
        )}
      </div>

      {filteredFiles.length > 0 ? (
        <div className="divide-y divide-[var(--line)]">
          {filteredFiles.map((file) => {
            const url = buildArchiveFileUrl(file.chainSlug, file.file);
            const previewable = canPreview(file);

            return (
              <article
                key={file.id}
                className="grid min-w-0 gap-4 py-5 sm:grid-cols-[2.5rem_minmax(0,1fr)] lg:grid-cols-[2.5rem_minmax(0,1fr)_auto] lg:items-center"
              >
                <span className="grid size-10 place-items-center rounded-md bg-[var(--accent-soft)] text-[var(--accent-strong)]">
                  <FileTypeIcon category={file.category} />
                </span>
                <div className="min-w-0">
                  <h2 className="break-words font-semibold text-[var(--ink)]">{file.title}</h2>
                  <p className="mt-1 break-all text-xs leading-5 text-[var(--muted)]">
                    {file.fileName} · {file.type} · {formatSize(file.size)}
                  </p>
                  <p className="mt-2 break-words text-sm leading-6 text-[var(--muted)]">
                    <span className="font-semibold text-[var(--ink)]">{file.chainTitle}</span>
                    <span aria-hidden="true"> · </span>
                    {file.emailSubject}
                    <span aria-hidden="true"> · </span>
                    <LocalDateTime date={file.emailDate} includeTime={false} />
                  </p>
                </div>
                <div className="col-span-full flex flex-wrap gap-2 sm:col-start-2 lg:col-auto lg:justify-end">
                  {previewable ? (
                    <button
                      type="button"
                      className="inline-flex min-h-11 items-center gap-2 rounded-md border border-[var(--line-strong)] px-3 text-sm font-semibold text-[var(--ink)] outline-none hover:border-[var(--accent)] hover:text-[var(--accent-strong)] focus-visible:ring-2 focus-visible:ring-[var(--accent)] focus-visible:ring-offset-2"
                      onClick={() =>
                        setPreviewFile({
                          category: file.category,
                          fileName: file.fileName,
                          title: file.title,
                          type: file.type,
                          url,
                        })
                      }
                    >
                      <EyeIcon className="size-4" />
                      Preview
                    </button>
                  ) : (
                    <a
                      href={url}
                      target="_blank"
                      rel="noreferrer noopener"
                      className="inline-flex min-h-11 items-center gap-2 rounded-md border border-[var(--line-strong)] px-3 text-sm font-semibold text-[var(--ink)] outline-none hover:border-[var(--accent)] hover:text-[var(--accent-strong)] focus-visible:ring-2 focus-visible:ring-[var(--accent)] focus-visible:ring-offset-2"
                    >
                      <ExternalLinkIcon className="size-4" />
                      Open
                    </a>
                  )}
                  <a
                    href={buildArchiveFileUrl(file.chainSlug, file.file, { download: true })}
                    className="inline-flex min-h-11 items-center gap-2 rounded-md px-3 text-sm font-semibold text-[var(--accent-strong)] outline-none hover:bg-[var(--accent-soft)] focus-visible:ring-2 focus-visible:ring-[var(--accent)] focus-visible:ring-offset-2"
                  >
                    <DownloadIcon className="size-4" />
                    Download
                  </a>
                </div>
              </article>
            );
          })}
        </div>
      ) : (
        <EmptyState
          title="No files match"
          description="Try another chain or file type, or clear the current filters."
        />
      )}

      <FilePreviewModal file={previewFile} onClose={() => setPreviewFile(null)} />
    </section>
  );
}
