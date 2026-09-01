import "server-only";

import path from "node:path";

import mime from "mime";

import { getArchiveRoot, type ArchiveLocationOptions } from "./archive-root";
import { ArchiveError } from "./errors";
import { resolveSafeArchiveFile, PathSafetyError } from "./path-safety";
import type {
  ArchiveEmail,
  ArchiveFileDiscoveryResult,
  ArchiveFileCategory,
  ArchiveFileEntry,
  ChainManifest,
} from "./types";

export const DEFAULT_BINARY_MIME_TYPE = "application/octet-stream";

export function getMimeType(filePath: string): string {
  return mime.getType(filePath) ?? DEFAULT_BINARY_MIME_TYPE;
}

export type FileDisposition = "attachment" | "inline";

export function getSafeDisposition(mimeType: string): FileDisposition {
  const normalized = mimeType.split(";", 1)[0].trim().toLowerCase();
  if (
    normalized === "application/pdf" ||
    normalized === "text/plain" ||
    normalized === "text/markdown" ||
    ["image/avif", "image/gif", "image/jpeg", "image/png", "image/webp"].includes(normalized)
  ) {
    return "inline";
  }

  // HTML, SVG, XML, Office files, and unknown content download rather than execute inline.
  return "attachment";
}

export function getFileCategory(mimeType: string, filePath = ""): ArchiveFileCategory {
  const normalized = mimeType.split(";", 1)[0].trim().toLowerCase();
  if (normalized === "application/pdf") return "pdf";
  if (normalized.startsWith("image/")) return "image";
  if (
    normalized.startsWith("text/") ||
    ["application/json", "application/xml", "application/yaml"].includes(normalized)
  ) {
    return "text";
  }
  if (
    /(?:msword|officedocument|ms-excel|ms-powerpoint|opendocument)/.test(normalized) ||
    /\.(?:docx?|xlsx?|pptx?|odt|ods|odp)$/i.test(filePath)
  ) {
    return "office";
  }
  return "other";
}

function asciiFileName(fileName: string): string {
  const safe = fileName
    .normalize("NFKD")
    .replace(/[^\x20-\x7e]/g, "_")
    .replace(/["\\/;\r\n]/g, "_")
    .trim();
  return safe || "archive-file";
}

export function buildContentDisposition(disposition: FileDisposition, fileName: string): string {
  const fallback = asciiFileName(fileName);
  const encoded = encodeURIComponent(fileName.replace(/[\r\n]/g, "_")).replace(
    /['()*]/g,
    (character) => `%${character.charCodeAt(0).toString(16).toUpperCase()}`,
  );
  return `${disposition}; filename="${fallback}"; filename*=UTF-8''${encoded}`;
}

export type AttachmentEnumerationOptions = ArchiveLocationOptions & {
  manifest?: ChainManifest;
  entries?: readonly ArchiveEmail[];
};

export async function enumerateAttachments(
  chainSlug: string,
  options: AttachmentEnumerationOptions = {},
): Promise<ArchiveFileEntry[]> {
  const { loadChainManifest } = await import("./chains");
  const { loadEmails } = await import("./emails");
  const archiveRoot = getArchiveRoot(options);
  const manifest = options.manifest ?? (await loadChainManifest(chainSlug, options));
  const entries = options.entries ?? (await loadEmails(chainSlug, options));
  const files: ArchiveFileEntry[] = [];

  for (const entry of entries) {
    for (const attachment of entry.attachments) {
      const segments = attachment.file.split("/");
      let resolved;
      try {
        resolved = await resolveSafeArchiveFile(archiveRoot, chainSlug, segments);
      } catch (error) {
        if (error instanceof PathSafetyError) {
          throw new ArchiveError(
            "missing-attachment",
            `Attachment "${attachment.title}" is missing or unsafe.`,
            { chainSlug, sourceFile: entry.sourceFile },
            { cause: error },
          );
        }
        throw error;
      }

      const resolvedType = getMimeType(resolved.absolutePath);
      files.push({
        ...attachment,
        type: resolvedType,
        id: `${chainSlug}:${entry.id}:${attachment.file}`,
        fileName: path.basename(attachment.file),
        category: getFileCategory(resolvedType, attachment.file),
        size: resolved.size,
        chainSlug,
        chainTitle: manifest.title,
        emailId: entry.id,
        emailSubject: entry.subject,
        emailDate: entry.date,
      });
    }
  }

  return files.sort(
    (left, right) =>
      Date.parse(left.emailDate) - Date.parse(right.emailDate) ||
      left.title.localeCompare(right.title) ||
      left.file.localeCompare(right.file),
  );
}

export async function enumerateArchiveFiles(
  options: ArchiveLocationOptions = {},
): Promise<ArchiveFileDiscoveryResult> {
  const { discoverChains } = await import("./chains");
  const discovery = await discoverChains(options);
  const groups = await Promise.all(
    discovery.chains.map(({ slug }) => enumerateAttachments(slug, options)),
  );

  const files = groups.flat().sort(
    (left, right) =>
      Date.parse(left.emailDate) - Date.parse(right.emailDate) ||
      left.chainTitle.localeCompare(right.chainTitle) ||
      left.title.localeCompare(right.title),
  );

  return { files, errors: discovery.errors };
}
