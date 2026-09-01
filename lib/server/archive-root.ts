import "server-only";

import path from "node:path";

export const DEFAULT_ARCHIVE_DATA_DIR = "data/chains";

export type ArchiveRootOptions = {
  configuredPath?: string;
  repositoryRoot?: string;
};

export type ArchiveLocationOptions = ArchiveRootOptions & {
  archiveRoot?: string;
};

export function resolveArchiveRoot({
  configuredPath = process.env.ARCHIVE_DATA_DIR,
  repositoryRoot = process.cwd(),
}: ArchiveRootOptions = {}): string {
  const requestedPath = configuredPath?.trim() || DEFAULT_ARCHIVE_DATA_DIR;

  return path.resolve(repositoryRoot, requestedPath);
}

export function getArchiveRoot(options: ArchiveLocationOptions = {}): string {
  return options.archiveRoot
    ? path.resolve(options.archiveRoot)
    : resolveArchiveRoot(options);
}
