import "server-only";

import { readdir, readFile } from "node:fs/promises";

import matter from "gray-matter";

import { EMAILS_DIRECTORY_NAME } from "./archive-layout";
import { getArchiveRoot, type ArchiveLocationOptions } from "./archive-root";
import { ArchiveError, describeValidationFailure } from "./errors";
import { PathSafetyError, resolveSafeArchiveFile, resolveSafeChainDirectory } from "./path-safety";
import { emailFrontmatterSchema } from "./schemas";
import type { ArchiveEmail } from "./types";

export function sortEmailsChronologically(entries: readonly ArchiveEmail[]): ArchiveEmail[] {
  return [...entries].sort((left, right) => {
    const byDate = Date.parse(left.date) - Date.parse(right.date);
    return (
      byDate ||
      left.id.localeCompare(right.id) ||
      left.sourceFile.localeCompare(right.sourceFile)
    );
  });
}

function rawDateValue(frontmatter: string): string | undefined {
  const match = /^date:\s*(?:"([^"]+)"|'([^']+)'|([^\s#]+))\s*(?:#.*)?$/m.exec(frontmatter);
  return match?.[1] ?? match?.[2] ?? match?.[3];
}

export function parseEmailMarkdown(
  markdown: string,
  sourceFile: string,
  expectedChainSlug: string,
): ArchiveEmail {
  let parsed;
  try {
    parsed = matter(markdown);
  } catch (error) {
    throw new ArchiveError(
      "invalid-email",
      "The email frontmatter is not valid YAML.",
      { chainSlug: expectedChainSlug, sourceFile },
      { cause: error },
    );
  }

  const metadata = { ...parsed.data };
  if (metadata.date instanceof Date) {
    // gray-matter's YAML engine turns timestamps into Date objects. Recover the
    // source scalar so validation can prove that an explicit timezone existed.
    metadata.date = rawDateValue(markdown);
  }

  const result = emailFrontmatterSchema.safeParse(metadata);
  if (!result.success) {
    throw new ArchiveError(
      "invalid-email",
      describeValidationFailure("email", result.error.issues),
      { chainSlug: expectedChainSlug, sourceFile },
    );
  }

  if (result.data.chain !== expectedChainSlug) {
    throw new ArchiveError(
      "invalid-email",
      "Invalid email metadata (chain: must match its chain directory).",
      { chainSlug: expectedChainSlug, sourceFile },
    );
  }

  return {
    ...result.data,
    attachments: result.data.attachments ?? [],
    body: parsed.content.trim(),
    sourceFile,
  };
}

export async function loadEmails(
  chainSlug: string,
  options: ArchiveLocationOptions = {},
): Promise<ArchiveEmail[]> {
  const archiveRoot = getArchiveRoot(options);
  let chainDirectory: string;
  try {
    chainDirectory = await resolveSafeChainDirectory(archiveRoot, chainSlug);
  } catch (error) {
    if (error instanceof PathSafetyError) {
      throw new ArchiveError("unknown-chain", "The requested chain was not found.", { chainSlug });
    }
    throw error;
  }

  let directoryEntries;
  try {
    directoryEntries = await readdir(`${chainDirectory}/${EMAILS_DIRECTORY_NAME}`, {
      withFileTypes: true,
    });
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return [];
    }
    throw new ArchiveError("filesystem-error", "The chain email directory could not be read.", {
      chainSlug,
    });
  }

  const fileNames = directoryEntries
    .filter(
      (entry) =>
        (entry.isFile() || entry.isSymbolicLink()) && entry.name.toLowerCase().endsWith(".md"),
    )
    .map((entry) => entry.name)
    .sort();
  const entries: ArchiveEmail[] = [];
  for (const sourceFile of fileNames) {
    try {
      const resolved = await resolveSafeArchiveFile(archiveRoot, chainSlug, [
        EMAILS_DIRECTORY_NAME,
        sourceFile,
      ]);
      entries.push(
        parseEmailMarkdown(await readFile(resolved.absolutePath, "utf8"), sourceFile, chainSlug),
      );
    } catch (error) {
      if (error instanceof ArchiveError) throw error;
      throw new ArchiveError(
        "invalid-email",
        "The email entry could not be read safely.",
        { chainSlug, sourceFile },
        { cause: error },
      );
    }
  }

  const ids = new Set<string>();
  for (const entry of entries) {
    if (ids.has(entry.id)) {
      throw new ArchiveError("invalid-email", `Duplicate email id: ${entry.id}.`, {
        chainSlug,
        sourceFile: entry.sourceFile,
      });
    }
    ids.add(entry.id);
  }

  return sortEmailsChronologically(entries);
}
