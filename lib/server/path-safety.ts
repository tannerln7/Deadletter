import "server-only";

import { open, realpath, stat, type FileHandle } from "node:fs/promises";
import path from "node:path";

import {
  parseArchiveRequestPath,
  PathSafetyError,
  type ParsedArchiveRequestPath,
} from "./request-path";

export {
  isValidChainSlug,
  parseArchiveRequestPath,
  PathSafetyError,
} from "./request-path";
export type {
  ParsedArchiveRequestPath,
  PathSafetyErrorCode,
} from "./request-path";

export type SafeArchiveFile = ParsedArchiveRequestPath & {
  absolutePath: string;
  chainDirectory: string;
  size: number;
};

export type OpenArchiveFile = SafeArchiveFile & {
  handle: FileHandle;
};

export function isPathInside(parentPath: string, candidatePath: string): boolean {
  const relative = path.relative(parentPath, candidatePath);

  return (
    relative !== "" &&
    relative !== ".." &&
    !relative.startsWith(`..${path.sep}`) &&
    !path.isAbsolute(relative)
  );
}

async function toRealPath(candidatePath: string): Promise<string> {
  try {
    return await realpath(candidatePath);
  } catch {
    throw new PathSafetyError("not-found", "Archive path was not found.");
  }
}

export async function resolveSafeChainDirectory(
  archiveRoot: string,
  chainSlug: string,
): Promise<string> {
  const parsed = parseArchiveRequestPath(chainSlug, ["chain.yml"]);
  const realArchiveRoot = await toRealPath(archiveRoot);
  const requestedChainDirectory = path.resolve(realArchiveRoot, parsed.chainSlug);

  if (!isPathInside(realArchiveRoot, requestedChainDirectory)) {
    throw new PathSafetyError("invalid-chain", "Chain directory is outside the archive root.");
  }

  const chainDirectory = await toRealPath(requestedChainDirectory);
  if (!isPathInside(realArchiveRoot, chainDirectory)) {
    throw new PathSafetyError("symlink-escape", "Chain directory leaves the archive root.");
  }

  let chainStats;
  try {
    chainStats = await stat(chainDirectory);
  } catch {
    throw new PathSafetyError("not-found", "Chain was not found.");
  }

  if (!chainStats.isDirectory()) {
    throw new PathSafetyError("invalid-chain", "Chain is not a directory.");
  }

  return chainDirectory;
}

export async function resolveSafeArchiveFile(
  archiveRoot: string,
  rawChainSlug: string,
  rawSegments: readonly string[],
): Promise<SafeArchiveFile> {
  const parsed = parseArchiveRequestPath(rawChainSlug, rawSegments);
  const chainDirectory = await resolveSafeChainDirectory(archiveRoot, parsed.chainSlug);
  const requestedFile = path.resolve(chainDirectory, ...parsed.segments);

  if (!isPathInside(chainDirectory, requestedFile)) {
    throw new PathSafetyError("invalid-path", "File path is outside the chain directory.");
  }

  const absolutePath = await toRealPath(requestedFile);
  if (!isPathInside(chainDirectory, absolutePath)) {
    throw new PathSafetyError("symlink-escape", "File path leaves the chain directory.");
  }

  let fileStats;
  try {
    fileStats = await stat(absolutePath);
  } catch {
    throw new PathSafetyError("not-found", "Archive file was not found.");
  }

  if (!fileStats.isFile()) {
    throw new PathSafetyError("not-file", "Archive path is not a regular file.");
  }

  return { ...parsed, absolutePath, chainDirectory, size: fileStats.size };
}

export async function openSafeArchiveFile(
  archiveRoot: string,
  rawChainSlug: string,
  rawSegments: readonly string[],
): Promise<OpenArchiveFile> {
  const resolved = await resolveSafeArchiveFile(archiveRoot, rawChainSlug, rawSegments);
  let handle: FileHandle;

  try {
    handle = await open(resolved.absolutePath, "r");
  } catch {
    throw new PathSafetyError("not-found", "Archive file was not found.");
  }

  try {
    const openedStats = await handle.stat();
    if (!openedStats.isFile()) {
      throw new PathSafetyError("not-file", "Archive path is not a regular file.");
    }

    return { ...resolved, handle, size: openedStats.size };
  } catch (error) {
    await handle.close().catch(() => undefined);
    throw error;
  }
}
