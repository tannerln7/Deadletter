import { cp, mkdtemp, readFile, symlink, unlink, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { migrateResourceIds } from "@/lib/server/resource-migration";
import { resolveArchiveResourceIndex } from "@/lib/server/resources";

async function legacyArchive() {
  const root = await mkdtemp(path.join(os.tmpdir(), "resource-migration-"));
  await cp(path.resolve("examples/archive-template"), root, { recursive: true });
  await writeFile(path.join(root, "archive.yml"), "collections:\n  - slug: example-records\n    title: Example Records\n    categories:\n      - slug: correspondence\n        title: Correspondence\n");
  await writeFile(path.join(root, "example-chain", "chain.yml"), "slug: example-chain\ntitle: Example Chain\ncollection: example-records\ncategory: correspondence\n");
  return root;
}

describe("stable resource ID migration", () => {
  it("checks without writing, assigns IDs once, and is idempotent", async () => {
    const root = await legacyArchive();
    const before = await readFile(path.join(root, "archive.yml"), "utf8");
    const checked = await migrateResourceIds({ archiveRoot: root });
    expect(checked.missingCount).toBe(2);
    expect(checked.wrote).toBe(false);
    expect(await readFile(path.join(root, "archive.yml"), "utf8")).toBe(before);

    const written = await migrateResourceIds({ archiveRoot: root, write: true });
    expect(written.wrote).toBe(true);
    const index = await resolveArchiveResourceIndex({ archiveRoot: root });
    expect(index.collections[0]?.resourceId).toMatch(/^[0-9a-f-]{36}$/);
    expect(index.chains[0]?.resourceId).toMatch(/^[0-9a-f-]{36}$/);
    const second = await migrateResourceIds({ archiveRoot: root, write: true });
    expect(second).toMatchObject({ missingCount: 0, wrote: false, issues: [] });
  });

  it("preserves valid IDs and aborts all writes on invalid content", async () => {
    const root = await legacyArchive();
    const chainPath = path.join(root, "example-chain", "chain.yml");
    await writeFile(chainPath, "slug: wrong\ntitle: Invalid\n");
    const before = await readFile(path.join(root, "archive.yml"), "utf8");
    const result = await migrateResourceIds({ archiveRoot: root, write: true });
    expect(result.wrote).toBe(false);
    expect(result.issues.some((issue) => issue.kind === "archive")).toBe(true);
    expect(await readFile(path.join(root, "archive.yml"), "utf8")).toBe(before);
  });

  it("distinguishes invalid and duplicate IDs from missing IDs", async () => {
    const root = await legacyArchive();
    await writeFile(path.join(root, "archive.yml"), "collections:\n  - slug: example-records\n    resourceId: not-a-uuid\n    title: Example Records\n");
    await writeFile(path.join(root, "example-chain", "chain.yml"), "slug: example-chain\nresourceId: not-a-uuid\ntitle: Example Chain\n");
    const invalid = await migrateResourceIds({ archiveRoot: root, write: true });
    expect(invalid.wrote).toBe(false);
    expect(invalid.issues.filter((issue) => issue.kind === "invalid")).toHaveLength(2);

    const duplicateId = "22222222-2222-4222-8222-222222222222";
    await writeFile(path.join(root, "archive.yml"), `collections:\n  - slug: example-records\n    resourceId: ${duplicateId}\n    title: Example Records\n`);
    await writeFile(path.join(root, "example-chain", "chain.yml"), `slug: example-chain\nresourceId: ${duplicateId}\ntitle: Example Chain\n`);
    const duplicate = await migrateResourceIds({ archiveRoot: root, write: true });
    expect(duplicate.wrote).toBe(false);
    expect(duplicate.issues.some((issue) => issue.kind === "duplicate")).toBe(true);
  });

  it.each(["''", "0", "null"])("does not replace a present but invalid falsey ID (%s)", async (yamlValue) => {
    const root = await legacyArchive();
    const archivePath = path.join(root, "archive.yml");
    await writeFile(archivePath, `collections:\n  - slug: example-records\n    resourceId: ${yamlValue}\n    title: Example Records\n`);
    const before = await readFile(archivePath, "utf8");

    const result = await migrateResourceIds({ archiveRoot: root, write: true });

    expect(result.wrote).toBe(false);
    expect(result.issues).toEqual(expect.arrayContaining([
      expect.objectContaining({ file: "archive.yml", kind: "invalid" }),
    ]));
    expect(await readFile(archivePath, "utf8")).toBe(before);
  });

  it("aborts without writes when a manifest is a symbolic link", async () => {
    const root = await legacyArchive();
    const archivePath = path.join(root, "archive.yml");
    const outside = path.join(await mkdtemp(path.join(os.tmpdir(), "resource-migration-outside-")), "archive.yml");
    await writeFile(outside, await readFile(archivePath, "utf8"));
    await unlink(archivePath);
    await symlink(outside, archivePath);
    const chainBefore = await readFile(path.join(root, "example-chain", "chain.yml"), "utf8");

    const result = await migrateResourceIds({ archiveRoot: root, write: true });

    expect(result.wrote).toBe(false);
    expect(result.issues).toEqual(expect.arrayContaining([
      expect.objectContaining({ file: "archive.yml", kind: "archive" }),
    ]));
    expect(await readFile(path.join(root, "example-chain", "chain.yml"), "utf8")).toBe(chainBefore);
  });
});
