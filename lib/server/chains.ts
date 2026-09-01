import "server-only";

import { readFile, readdir, stat } from "node:fs/promises";
import matter from "gray-matter";

import { getArchiveRoot, type ArchiveLocationOptions } from "./archive-root";
import {
  ATTACHMENTS_DIRECTORY_NAME,
  CHAIN_MANIFEST_FILENAME,
  EMAILS_DIRECTORY_NAME,
} from "./archive-layout";
import { ArchiveError, describeValidationFailure } from "./errors";
import { loadEmails } from "./emails";
import { enumerateAttachments } from "./files";
import { PathSafetyError, resolveSafeArchiveFile } from "./path-safety";
import { chainManifestSchema } from "./schemas";
import type {
  ArchiveChainSummary,
  ArchiveDiscoveryResult,
  ChainManifest,
} from "./types";

export { ATTACHMENTS_DIRECTORY_NAME, CHAIN_MANIFEST_FILENAME, EMAILS_DIRECTORY_NAME };

function pathErrorToArchiveError(error: PathSafetyError, chainSlug: string): ArchiveError {
  if (error.code === "invalid-chain") {
    return new ArchiveError("invalid-chain-slug", "The requested chain slug is invalid.", {
      chainSlug,
    });
  }
  if (error.code === "not-found" || error.code === "not-file") {
    return new ArchiveError("unknown-chain", "The requested chain was not found.", { chainSlug });
  }

  return new ArchiveError("unsafe-path", "The requested chain is not safely contained in the archive.", {
    chainSlug,
  });
}

function parseYamlDocument(source: string): unknown {
  return matter(`---\n${source}\n---`).data;
}

export async function loadChainManifest(
  chainSlug: string,
  options: ArchiveLocationOptions = {},
): Promise<ChainManifest> {
  const archiveRoot = getArchiveRoot(options);
  try {
    const archiveStats = await stat(archiveRoot);
    if (!archiveStats.isDirectory()) {
      throw new ArchiveError("archive-not-found", "The configured archive path is not a directory.");
    }
  } catch (error) {
    if (error instanceof ArchiveError) throw error;
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      throw new ArchiveError("archive-not-found", "The configured archive directory was not found.");
    }
    throw new ArchiveError("filesystem-error", "The configured archive directory could not be read.");
  }
  let manifestFile;
  try {
    manifestFile = await resolveSafeArchiveFile(archiveRoot, chainSlug, [CHAIN_MANIFEST_FILENAME]);
  } catch (error) {
    if (error instanceof PathSafetyError) {
      if (error.code === "not-found") {
        const { resolveSafeChainDirectory } = await import("./path-safety");
        try {
          await resolveSafeChainDirectory(archiveRoot, chainSlug);
          throw new ArchiveError(
            "invalid-manifest",
            "The chain manifest is missing.",
            { chainSlug, sourceFile: CHAIN_MANIFEST_FILENAME },
          );
        } catch (chainError) {
          if (chainError instanceof ArchiveError) throw chainError;
          if (!(chainError instanceof PathSafetyError) || chainError.code !== "not-found") {
            throw chainError;
          }
        }
      }
      throw pathErrorToArchiveError(error, chainSlug);
    }
    throw error;
  }

  let parsed: unknown;
  try {
    parsed = parseYamlDocument(await readFile(manifestFile.absolutePath, "utf8"));
  } catch (error) {
    throw new ArchiveError(
      "invalid-manifest",
      "The chain manifest is not valid YAML.",
      { chainSlug, sourceFile: CHAIN_MANIFEST_FILENAME },
      { cause: error },
    );
  }

  const result = chainManifestSchema.safeParse(parsed);
  if (!result.success) {
    throw new ArchiveError(
      "invalid-manifest",
      describeValidationFailure("manifest", result.error.issues),
      { chainSlug, sourceFile: CHAIN_MANIFEST_FILENAME },
    );
  }

  if (result.data.slug !== chainSlug) {
    throw new ArchiveError(
      "invalid-manifest",
      "Invalid manifest metadata (slug: must match its chain directory).",
      { chainSlug, sourceFile: CHAIN_MANIFEST_FILENAME },
    );
  }

  return result.data;
}

export type LoadedChain = {
  manifest: ChainManifest;
  entries: Awaited<ReturnType<typeof loadEmails>>;
  summary: ArchiveChainSummary;
};

export async function loadChain(
  chainSlug: string,
  options: ArchiveLocationOptions = {},
): Promise<LoadedChain> {
  const manifest = await loadChainManifest(chainSlug, options);
  const entries = await loadEmails(chainSlug, options);
  const files = await enumerateAttachments(chainSlug, { ...options, manifest, entries });
  const summary: ArchiveChainSummary = {
    ...manifest,
    entryCount: entries.length,
    attachmentCount: files.length,
    earliestDate: entries.at(0)?.date,
    latestDate: entries.at(-1)?.date,
  };

  return { manifest, entries, summary };
}

export async function discoverChains(
  options: ArchiveLocationOptions = {},
): Promise<ArchiveDiscoveryResult> {
  const archiveRoot = getArchiveRoot(options);
  let directoryEntries;
  try {
    directoryEntries = await readdir(archiveRoot, { withFileTypes: true });
  } catch (error) {
    const code = (error as NodeJS.ErrnoException).code;
    if (code === "ENOENT" || code === "ENOTDIR") {
      throw new ArchiveError("archive-not-found", "The configured archive directory was not found.");
    }
    throw new ArchiveError("filesystem-error", "The archive directory could not be read.", {}, { cause: error });
  }

  const candidates = directoryEntries
    .filter((entry) => entry.isDirectory() || entry.isSymbolicLink())
    .map((entry) => entry.name)
    .filter((name) => !name.startsWith("."))
    .sort();

  const chains: ArchiveChainSummary[] = [];
  const errors: ArchiveDiscoveryResult["errors"] = [];
  for (const chainSlug of candidates) {
    try {
      chains.push((await loadChain(chainSlug, options)).summary);
    } catch (error) {
      if (error instanceof ArchiveError) {
        errors.push(error.toDiagnostic());
      } else {
        errors.push({
          code: "filesystem-error",
          chainSlug,
          message: "The chain could not be read.",
        });
      }
    }
  }

  chains.sort(
    (left, right) =>
      (left.displayOrder ?? Number.POSITIVE_INFINITY) -
        (right.displayOrder ?? Number.POSITIVE_INFINITY) ||
      left.title.localeCompare(right.title) ||
      left.slug.localeCompare(right.slug),
  );

  return { chains, errors };
}
