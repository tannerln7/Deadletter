import path from "node:path";

import { describe, expect, it } from "vitest";

import {
  DEFAULT_ARCHIVE_DATA_DIR,
  resolveArchiveRoot,
} from "@/lib/server/archive-root";

describe("resolveArchiveRoot", () => {
  it("uses the repository-local default", () => {
    expect(resolveArchiveRoot({ repositoryRoot: "/srv/app" })).toBe(
      path.resolve("/srv/app", DEFAULT_ARCHIVE_DATA_DIR),
    );
  });

  it("resolves configured relative paths from the repository root", () => {
    expect(
      resolveArchiveRoot({
        configuredPath: "../private/archive",
        repositoryRoot: "/srv/app",
      }),
    ).toBe("/srv/private/archive");
  });

  it("preserves configured absolute paths", () => {
    expect(
      resolveArchiveRoot({
        configuredPath: "/mnt/private/archive",
        repositoryRoot: "/srv/app",
      }),
    ).toBe("/mnt/private/archive");
  });
});
