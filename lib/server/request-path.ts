import "server-only";

import path from "node:path";

export type PathSafetyErrorCode =
  | "invalid-chain"
  | "invalid-path"
  | "not-found"
  | "not-file"
  | "symlink-escape";

export class PathSafetyError extends Error {
  constructor(
    public readonly code: PathSafetyErrorCode,
    message: string,
  ) {
    super(message);
    this.name = "PathSafetyError";
  }
}

export type ParsedArchiveRequestPath = {
  chainSlug: string;
  relativePath: string;
  segments: string[];
};

export function isValidChainSlug(value: string): boolean {
  return /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(value);
}

function decodeSegment(rawSegment: string): string {
  let segment = rawSegment;

  // Route params may already have been decoded once by the framework. Decode a
  // small bounded number of times so double-encoded traversal cannot survive.
  for (let pass = 0; pass < 3; pass += 1) {
    try {
      const decoded = decodeURIComponent(segment);
      segment = decoded;
    } catch {
      throw new PathSafetyError("invalid-path", "Path segment is not valid URL encoding.");
    }

    if (
      segment.length === 0 ||
      segment === "." ||
      segment === ".." ||
      segment.includes("\0") ||
      segment.includes("/") ||
      segment.includes("\\") ||
      path.posix.isAbsolute(segment) ||
      path.win32.isAbsolute(segment)
    ) {
      throw new PathSafetyError("invalid-path", "Path segment is not allowed.");
    }

    if (!segment.includes("%")) break;
  }

  return segment;
}

export function parseArchiveRequestPath(
  rawChainSlug: string,
  rawSegments: readonly string[],
): ParsedArchiveRequestPath {
  const chainSlug = decodeSegment(rawChainSlug);

  if (!isValidChainSlug(chainSlug)) {
    throw new PathSafetyError("invalid-chain", "Chain slug is not allowed.");
  }

  if (rawSegments.length === 0) {
    throw new PathSafetyError("invalid-path", "A file path is required.");
  }

  const segments = rawSegments.map(decodeSegment);

  return {
    chainSlug,
    relativePath: segments.join("/"),
    segments,
  };
}
