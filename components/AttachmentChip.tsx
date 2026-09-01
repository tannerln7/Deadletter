"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import {
  buildArchiveFileUrl,
  buildSharedArchiveFileUrl,
} from "@/lib/archive-url";

import type { ArchiveAttachment, ArchiveFileCategory } from "@/lib/server/types";

import FilePreviewModal, { type PreviewFile } from "./FilePreviewModal";
import { DocumentIcon, DownloadIcon, EyeIcon, FileIcon, ImageIcon } from "./Icons";
import { usePreviewCache } from "./PreviewCacheProvider";

type AttachmentChipProps = {
  attachment: ArchiveAttachment;
  chainSlug: string;
  sharedGrantId?: string;
  preload?: boolean;
};

function attachmentCategory(type: string): ArchiveFileCategory {
  const normalized = type.split(";", 1)[0].toLowerCase();
  if (normalized === "application/pdf") return "pdf";
  if (normalized.startsWith("image/")) return "image";
  if (normalized.startsWith("text/") || normalized === "application/json") return "text";
  if (/officedocument|msword|ms-excel|ms-powerpoint|opendocument/.test(normalized)) {
    return "office";
  }
  return "other";
}

function TypeIcon({ category }: { category: ArchiveFileCategory }) {
  if (category === "image") return <ImageIcon className="size-4" />;
  if (category === "pdf" || category === "text") return <DocumentIcon className="size-4" />;
  return <FileIcon className="size-4" />;
}

export default function AttachmentChip({ attachment, chainSlug, sharedGrantId, preload: allowPreload = true }: AttachmentChipProps) {
  const attachmentRef = useRef<HTMLDivElement>(null);
  const [previewFile, setPreviewFile] = useState<PreviewFile | null>(null);
  const previewCache = usePreviewCache();
  const url = sharedGrantId
    ? buildSharedArchiveFileUrl(sharedGrantId, chainSlug, attachment.file)
    : buildArchiveFileUrl(chainSlug, attachment.file);
  const category = attachmentCategory(attachment.type);
  const fileName = attachment.file.split("/").at(-1) ?? attachment.file;
  const normalizedType = attachment.type.split(";", 1)[0].toLowerCase();
  const canPreview =
    category === "pdf" ||
    (category === "image" && normalizedType !== "image/svg+xml") ||
    normalizedType === "text/plain" ||
    normalizedType === "text/markdown";

  const preload = useCallback(() => {
    if (allowPreload && canPreview) void previewCache.load(url).catch(() => undefined);
  }, [allowPreload, canPreview, previewCache, url]);

  useEffect(() => {
    const attachmentElement = attachmentRef.current;
    if (!allowPreload || !canPreview || !attachmentElement || typeof IntersectionObserver === "undefined") return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          preload();
          observer.disconnect();
        }
      },
      { rootMargin: "600px 0px" },
    );

    observer.observe(attachmentElement);
    return () => observer.disconnect();
  }, [allowPreload, canPreview, preload]);

  return (
    <>
      <div
        ref={attachmentRef}
        className="grid min-w-0 gap-3 rounded-lg border border-[var(--line)] bg-[var(--surface-subtle)] p-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center sm:px-4"
        onFocusCapture={preload}
        onPointerDownCapture={preload}
        onPointerEnter={preload}
      >
        <div className="flex min-w-0 items-start gap-3">
          <span className="mt-0.5 grid size-8 shrink-0 place-items-center rounded-md bg-[var(--surface)] text-[var(--accent-strong)] ring-1 ring-[var(--line)]">
            <TypeIcon category={category} />
          </span>
          <div className="min-w-0">
            <p className="break-words text-sm font-semibold leading-5 text-[var(--ink)]">
              {attachment.title}
            </p>
            <p className="mt-0.5 break-all text-xs leading-5 text-[var(--muted)]">
              {fileName} · {attachment.type}
            </p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2 sm:justify-end">
          {canPreview ? (
            <button
              type="button"
              className="inline-flex min-h-11 items-center gap-2 rounded-md px-3 text-sm font-semibold text-[var(--accent-strong)] outline-none hover:bg-[var(--surface)] focus-visible:ring-2 focus-visible:ring-[var(--accent)] focus-visible:ring-offset-2"
              onClick={() => {
                const resource = previewCache.load(url);
                setPreviewFile({
                  category,
                  fileName,
                  resource,
                  title: attachment.title,
                  type: attachment.type,
                  url,
                });
              }}
            >
              <EyeIcon className="size-4" />
              Preview
            </button>
          ) : (
            <a
              href={url}
              target="_blank"
              rel="noreferrer noopener"
              className="inline-flex min-h-11 items-center gap-2 rounded-md px-3 text-sm font-semibold text-[var(--accent-strong)] outline-none hover:bg-[var(--surface)] focus-visible:ring-2 focus-visible:ring-[var(--accent)] focus-visible:ring-offset-2"
            >
              Open
            </a>
          )}
          <a
            href={
              sharedGrantId
              ? buildSharedArchiveFileUrl(
                  sharedGrantId,
                  chainSlug,
                  attachment.file,
                  { download: true },
                )
              : buildArchiveFileUrl(
                  chainSlug,
                  attachment.file,
                  { download: true },
                )
            }
            className="inline-flex min-h-11 items-center gap-2 rounded-md px-3 text-sm font-semibold text-[var(--ink)] outline-none hover:bg-[var(--surface)] focus-visible:ring-2 focus-visible:ring-[var(--accent)] focus-visible:ring-offset-2"
          >
            <DownloadIcon className="size-4" />
            Download
          </a>
        </div>
      </div>
      <FilePreviewModal file={previewFile} onClose={() => setPreviewFile(null)} />
    </>
  );
}
