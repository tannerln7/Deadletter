import { mkdir, mkdtemp, symlink, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { describe, expect, it } from "vitest";

import {
  buildArchiveHierarchy,
  discoverArchiveHierarchy,
  loadArchiveOrganization,
} from "@/lib/server/organization";
import type { ArchiveChainSummary } from "@/lib/server/types";

const fixtureRoot = path.resolve("examples/archive/chains");

function chain(
  slug: string,
  title: string,
  membership: { collection?: string; category?: string } = {},
): ArchiveChainSummary {
  return {
    slug,
    title,
    ...membership,
    entryCount: 0,
    attachmentCount: 0,
  };
}

describe("archive organization", () => {
  it("treats a missing archive.yml as an ungrouped archive", async () => {
    const archiveRoot = await mkdtemp(path.join(os.tmpdir(), "archive-organization-missing-"));
    const organization = await loadArchiveOrganization({ archiveRoot });
    const hierarchy = buildArchiveHierarchy([chain("one", "One")], organization);

    expect(organization).toEqual({ errors: [] });
    expect(hierarchy.collections).toEqual([]);
    expect(hierarchy.ungrouped.map(({ slug }) => slug)).toEqual(["one"]);
  });

  it("loads the fixture hierarchy while retaining an ungrouped chain", async () => {
    const hierarchy = await discoverArchiveHierarchy({ archiveRoot: fixtureRoot });

    expect(hierarchy.errors).toEqual([]);
    expect(hierarchy.collections).toEqual([
      expect.objectContaining({
        slug: "household-projects",
        categories: [
          expect.objectContaining({
            slug: "repairs",
            chains: [expect.objectContaining({ slug: "property-repair" })],
          }),
        ],
      }),
    ]);
    expect(hierarchy.ungrouped.map(({ slug }) => slug)).toEqual(["inventory-records"]);
  });

  it("sorts collections and categories by display order, title, and slug", () => {
    const hierarchy = buildArchiveHierarchy([], {
      manifest: {
        collections: [
          { slug: "later", title: "Later", displayOrder: 20 },
          {
            slug: "first",
            title: "First",
            displayOrder: 10,
            categories: [
              { slug: "zeta", title: "Zeta" },
              { slug: "beta", title: "Beta", displayOrder: 2 },
              { slug: "alpha", title: "Alpha", displayOrder: 2 },
            ],
          },
        ],
      },
      errors: [],
    });

    expect(hierarchy.collections.map(({ slug }) => slug)).toEqual(["first", "later"]);
    expect(hierarchy.collections[0]?.categories.map(({ slug }) => slug)).toEqual([
      "alpha",
      "beta",
      "zeta",
    ]);
  });

  it("falls back to ungrouped with a safe diagnostic for an invalid root manifest", async () => {
    const archiveRoot = await mkdtemp(path.join(os.tmpdir(), "archive-organization-invalid-"));
    await writeFile(path.join(archiveRoot, "archive.yml"), "collections:\n  - slug: NOT-SAFE\n");

    const organization = await loadArchiveOrganization({ archiveRoot });
    const hierarchy = buildArchiveHierarchy([chain("one", "One")], organization);

    expect(hierarchy.collections).toEqual([]);
    expect(hierarchy.ungrouped.map(({ slug }) => slug)).toEqual(["one"]);
    expect(hierarchy.errors).toEqual([
      expect.objectContaining({
        code: "invalid-organization",
        sourceFile: "archive.yml",
      }),
    ]);
    expect(hierarchy.errors[0]?.message).not.toContain(archiveRoot);
  });

  it("rejects an archive.yml symbolic link that leaves the archive root", async () => {
    const testRoot = await mkdtemp(path.join(os.tmpdir(), "archive-organization-symlink-"));
    const archiveRoot = path.join(testRoot, "archive");
    await mkdir(archiveRoot);
    await writeFile(path.join(testRoot, "outside.yml"), "collections: []\n");
    await symlink(path.join(testRoot, "outside.yml"), path.join(archiveRoot, "archive.yml"));

    const organization = await loadArchiveOrganization({ archiveRoot });

    expect(organization.errors).toEqual([
      expect.objectContaining({
        code: "invalid-organization",
        message: expect.stringMatching(/safely contained/i),
      }),
    ]);
  });

  it("falls back unknown collection and category references in chain order", () => {
    const hierarchy = buildArchiveHierarchy(
      [
        chain("unknown-collection", "Unknown collection", { collection: "missing" }),
        chain("unknown-category", "Unknown category", {
          collection: "records",
          category: "missing",
        }),
        chain("known", "Known", { collection: "records", category: "letters" }),
      ],
      {
        manifest: {
          collections: [
            {
              slug: "records",
              title: "Records",
              categories: [{ slug: "letters", title: "Letters" }],
            },
          ],
        },
        errors: [],
      },
    );

    expect(hierarchy.ungrouped.map(({ slug }) => slug)).toEqual([
      "unknown-collection",
      "unknown-category",
    ]);
    expect(hierarchy.errors.map(({ chainSlug }) => chainSlug)).toEqual([
      "unknown-collection",
      "unknown-category",
    ]);
    expect(hierarchy.collections[0]?.categories[0]?.chains.map(({ slug }) => slug)).toEqual([
      "known",
    ]);
  });
});
