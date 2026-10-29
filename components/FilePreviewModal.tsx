"use client";

/* eslint-disable @next/next/no-img-element */

import { type ReactNode, useEffect, useRef, useState } from "react";

import type { ArchiveFileCategory } from "@/lib/server/types";

import { CloseIcon, DownloadIcon, ExternalLinkIcon } from "./Icons";
import MarkdownContent from "./MarkdownContent";

export type PreviewFile = {
  category: ArchiveFileCategory;
  fileName: string;
  resource?: Promise<Blob>;
  title: string;
  type: string;
  url: string;
};

type FilePreviewModalProps = {
  file: PreviewFile | null;
  onClose: () => void;
};

function isInlineImage(file: PreviewFile): boolean {
  return file.category === "image" && file.type.toLowerCase() !== "image/svg+xml";
}

function isReadableText(file: PreviewFile): boolean {
  const normalizedType = file.type.split(";", 1)[0].toLowerCase();
  return normalizedType === "text/plain" || normalizedType === "text/markdown";
}

function TextPreview({ file }: { file: PreviewFile }) {
  const [content, setContent] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    let active = true;

    const resource =
      file.resource ??
      fetch(file.url, { cache: "no-store", signal: controller.signal }).then((response) => {
        if (!response.ok) throw new Error("Preview unavailable");
        return response.blob();
      });

    resource
      .then((response) => {
        return response.text();
      })
      .then((nextContent) => {
        if (active) setContent(nextContent);
      })
      .catch((error: unknown) => {
        if (active && (error as { name?: string }).name !== "AbortError") setFailed(true);
      });

    return () => {
      active = false;
      controller.abort();
    };
  }, [file.resource, file.url]);

  if (failed) {
    return (
      <PreviewFallback message="This text preview is no longer available. The file may have changed on disk." />
    );
  }

  if (content === null) {
    return <p className="px-1 py-12 text-center text-sm text-[var(--muted)]">Loading preview…</p>;
  }

  if (file.type.split(";", 1)[0].toLowerCase() === "text/markdown") {
    return (
      <div className="rounded-lg border border-[var(--line)] bg-[var(--surface)] p-5 sm:p-7">
        <MarkdownContent>{content}</MarkdownContent>
      </div>
    );
  }

  return (
    <pre className="max-h-[62dvh] overflow-auto whitespace-pre-wrap break-words rounded-lg border border-[var(--line)] bg-[var(--surface-subtle)] p-5 font-mono text-sm leading-6 text-[var(--ink)] sm:p-7">
      {content}
    </pre>
  );
}

function CachedObjectPreview({
  children,
  file,
}: {
  children: (source: string) => ReactNode;
  file: PreviewFile;
}) {
  const [source, setSource] = useState<string | null>(file.resource ? null : file.url);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (!file.resource) return;

    let active = true;
    let objectUrl: string | null = null;

    file.resource
      .then((blob) => {
        if (!active) return;
        objectUrl = URL.createObjectURL(blob);
        setSource(objectUrl);
      })
      .catch(() => {
        if (active) setFailed(true);
      });

    return () => {
      active = false;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [file.resource, file.url]);

  if (failed) {
    return (
      <PreviewFallback message="This preview is no longer available. The file may have changed on disk." />
    );
  }

  if (!source) {
    return <p className="px-1 py-12 text-center text-sm text-[var(--muted)]">Loading preview…</p>;
  }

  return children(source);
}

function PreviewFallback({ message }: { message: string }) {
  return (
    <div className="grid min-h-64 place-items-center rounded-lg border border-dashed border-[var(--line-strong)] bg-[var(--surface-subtle)] p-8 text-center">
      <p className="max-w-md text-sm leading-6 text-[var(--muted)]">{message}</p>
    </div>
  );
}

function PreviewSurface({ file }: { file: PreviewFile }) {
  if (file.category === "pdf") {
    return (
      <CachedObjectPreview key={file.url} file={file}>
        {(source) => (
          <object
            aria-label={`Preview of ${file.title}`}
            className="h-[68dvh] min-h-80 w-full rounded-lg border border-[var(--line)] bg-[var(--surface-subtle)]"
            data={source}
            type="application/pdf"
          >
            <PreviewFallback message="Your browser could not display this PDF inline. Use Open in new tab or Download instead." />
          </object>
        )}
      </CachedObjectPreview>
    );
  }

  if (isInlineImage(file)) {
    return (
      <CachedObjectPreview key={file.url} file={file}>
        {(source) => (
          <div className="grid min-h-64 place-items-center overflow-hidden rounded-lg border border-[var(--line)] bg-[var(--surface-subtle)] p-3 sm:p-5">
            <img
              alt={file.title}
              className="max-h-[66dvh] max-w-full object-contain"
              src={source}
            />
          </div>
        )}
      </CachedObjectPreview>
    );
  }

  if (isReadableText(file)) {
    return <TextPreview key={file.url} file={file} />;
  }

  return (
    <PreviewFallback message="This file type is not previewed in the application. Open it in a new tab or download the original file." />
  );
}

export default function FilePreviewModal({ file, onClose }: FilePreviewModalProps) {
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const returnFocusRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!file) return;

    returnFocusRef.current = document.activeElement as HTMLElement | null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    closeButtonRef.current?.focus();

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = previousOverflow;
      returnFocusRef.current?.focus();
    };
  }, [file, onClose]);

  if (!file) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="file-preview-title"
      className="fixed inset-0 z-50 grid place-items-center overflow-y-auto bg-[var(--modal-overlay)] p-4 backdrop-blur-[2px] sm:p-8"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div className="flex max-h-[calc(100dvh-2rem)] w-full max-w-[68rem] flex-col overflow-hidden rounded-xl border border-[var(--line-strong)] bg-[var(--surface)] text-[var(--ink)] shadow-[var(--modal-shadow)] sm:max-h-[calc(100dvh-4rem)]">
        <header className="flex shrink-0 items-start justify-between gap-4 border-b border-[var(--line)] px-4 py-4 sm:px-6">
          <div className="min-w-0">
            <h2
              id="file-preview-title"
              className="break-words text-lg font-semibold tracking-[-0.02em] text-[var(--ink)]"
            >
              {file.title}
            </h2>
            <p className="mt-1 break-all text-xs text-[var(--muted)]">
              {file.fileName} · {file.type}
            </p>
          </div>
          <button
            ref={closeButtonRef}
            type="button"
            className="inline-flex min-h-11 shrink-0 items-center gap-2 rounded-md border border-[var(--line-strong)] px-3 text-sm font-semibold text-[var(--ink)] outline-none hover:border-[var(--accent)] hover:text-[var(--accent-strong)] focus-visible:ring-2 focus-visible:ring-[var(--accent)] focus-visible:ring-offset-2"
            onClick={onClose}
          >
            Close
            <CloseIcon className="size-4" />
          </button>
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-4 sm:p-6">
          <PreviewSurface file={file} />
        </div>

        <footer className="flex shrink-0 flex-col-reverse gap-2 border-t border-[var(--line)] bg-[var(--surface)] px-4 py-3 sm:flex-row sm:justify-end sm:px-6">
          <a
            href={file.url}
            target="_blank"
            rel="noreferrer noopener"
            className="inline-flex min-h-11 items-center justify-center gap-2 rounded-md border border-[var(--line-strong)] px-4 text-sm font-semibold text-[var(--ink)] outline-none hover:border-[var(--accent)] hover:text-[var(--accent-strong)] focus-visible:ring-2 focus-visible:ring-[var(--accent)] focus-visible:ring-offset-2"
          >
            <ExternalLinkIcon className="size-4" />
            Open in new tab
          </a>
          <a
            href={`${file.url}${file.url.includes("?") ? "&" : "?"}download=1`}
            className="inline-flex min-h-11 items-center justify-center gap-2 rounded-md bg-[var(--accent)] px-4 text-sm font-semibold text-[var(--on-accent)] outline-none hover:bg-[var(--accent-hover)] focus-visible:ring-2 focus-visible:ring-[var(--accent)] focus-visible:ring-offset-2"
          >
            <DownloadIcon className="size-4" />
            Download
          </a>
        </footer>
      </div>
    </div>
  );
}
