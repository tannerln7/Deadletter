import "server-only";

import type { ArchiveDiagnostic, ArchiveErrorCode } from "./types";

export class ArchiveError extends Error {
  constructor(
    public readonly code: ArchiveErrorCode,
    message: string,
    public readonly context: { chainSlug?: string; sourceFile?: string } = {},
    options?: ErrorOptions,
  ) {
    super(message, options);
    this.name = "ArchiveError";
  }

  toDiagnostic(): ArchiveDiagnostic {
    return { code: this.code, message: this.message, ...this.context };
  }
}

export function describeValidationFailure(
  kind: "manifest" | "email" | "archive organization",
  issues: readonly { path: PropertyKey[]; message: string }[],
): string {
  const details = issues
    .slice(0, 4)
    .map(({ path, message }) => `${path.length > 0 ? path.join(".") : kind}: ${message}`)
    .join("; ");

  return `Invalid ${kind} metadata${details ? ` (${details})` : ""}.`;
}
