import { mkdir, mkdtemp, symlink, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { describe, expect, it } from "vitest";

import {
  isPathInside,
  parseArchiveRequestPath,
  PathSafetyError,
  resolveSafeArchiveFile,
} from "@/lib/server/path-safety";

describe("parseArchiveRequestPath", () => {
  it("accepts a safe chain and nested attachment path", () => {
    expect(parseArchiveRequestPath("property-repair", ["attachments", "estimate.pdf"])).toEqual({
      chainSlug: "property-repair",
      relativePath: "attachments/estimate.pdf",
      segments: ["attachments", "estimate.pdf"],
    });
  });

  it.each([
    ["../property-repair", ["estimate.pdf"]],
    ["property-repair", ["..", "estimate.pdf"]],
    ["property-repair", ["%2e%2e", "estimate.pdf"]],
    ["property-repair", ["%252e%252e", "estimate.pdf"]],
    ["property-repair", ["attachments%2Foutside.pdf"]],
    ["property-repair", ["/etc/passwd"]],
    ["property-repair", ["C:%5CWindows"]],
    ["property-repair", [""]],
  ])("rejects unsafe input %#", (chain, segments) => {
    expect(() => parseArchiveRequestPath(chain, segments)).toThrow(PathSafetyError);
  });
});

describe("filesystem containment", () => {
  it("does not confuse a sibling prefix with a contained path", () => {
    expect(isPathInside("/archive/chain", "/archive/chain-old/file.txt")).toBe(false);
    expect(isPathInside("/archive/chain", "/archive/chain/file.txt")).toBe(true);
  });

  it("accepts a regular nested file", async () => {
    const archiveRoot = await mkdtemp(path.join(os.tmpdir(), "deadletter-"));
    await mkdir(path.join(archiveRoot, "property-repair", "attachments", "nested"), { recursive: true });
    await writeFile(path.join(archiveRoot, "property-repair", "chain.yml"), "slug: property-repair\ntitle: Test\n");
    await writeFile(path.join(archiveRoot, "property-repair", "attachments", "nested", "note.txt"), "safe");
    await expect(
      resolveSafeArchiveFile(archiveRoot, "property-repair", ["attachments", "nested", "note.txt"]),
    ).resolves.toMatchObject({ relativePath: "attachments/nested/note.txt", size: 4 });
  });

  it("rejects symbolic-link escapes including sibling-prefix targets", async () => {
    const testRoot = await mkdtemp(path.join(os.tmpdir(), "deadletter-"));
    const archiveRoot = path.join(testRoot, "archive");
    const chain = path.join(archiveRoot, "property-repair");
    const sibling = path.join(archiveRoot, "property-repair-old");
    await mkdir(path.join(chain, "attachments"), { recursive: true });
    await mkdir(sibling, { recursive: true });
    await writeFile(path.join(chain, "chain.yml"), "slug: property-repair\ntitle: Test\n");
    await writeFile(path.join(sibling, "outside.txt"), "outside");
    await symlink(path.join(sibling, "outside.txt"), path.join(chain, "attachments", "escape.txt"));
    await expect(
      resolveSafeArchiveFile(archiveRoot, "property-repair", ["attachments", "escape.txt"]),
    ).rejects.toMatchObject({ code: "symlink-escape" });
  });

  it("rejects a directory when a regular file is expected", async () => {
    const archiveRoot = await mkdtemp(path.join(os.tmpdir(), "deadletter-"));
    await mkdir(path.join(archiveRoot, "property-repair", "attachments"), { recursive: true });
    await writeFile(path.join(archiveRoot, "property-repair", "chain.yml"), "slug: property-repair\ntitle: Test\n");
    await expect(
      resolveSafeArchiveFile(archiveRoot, "property-repair", ["attachments"]),
    ).rejects.toMatchObject({ code: "not-file" });
  });
});
