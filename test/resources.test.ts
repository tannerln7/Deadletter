import { cp, mkdtemp, readFile, rename, symlink, unlink, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { chainIsInCollection, resolveArchiveResourceIndex, ResourceResolutionError } from "@/lib/server/resources";

async function fixtureCopy() {
  const root = await mkdtemp(path.join(os.tmpdir(), "resource-index-"));
  await cp(path.resolve("examples/archive/chains"), root, { recursive: true });
  return root;
}

describe("manifest-only archive resource resolver", () => {
  it("resolves stable IDs and live membership without reading email bodies", async () => {
    const index = await resolveArchiveResourceIndex({ archiveRoot: path.resolve("examples/archive/chains") });
    const collection = index.collections[0]!;
    const chain = index.chains.find((candidate) => candidate.slug === "property-repair")!;
    expect(chainIsInCollection(chain, collection)).toBe(true);
    expect(index.chains.find((candidate) => candidate.slug === "inventory-records")?.collection).toBeUndefined();
  });

  it("retains identity when a chain slug and directory are renamed", async () => {
    const root = await fixtureCopy();
    const oldPath = path.join(root, "property-repair");
    const nextPath = path.join(root, "renamed-repair");
    const manifest = (await readFile(path.join(oldPath, "chain.yml"), "utf8")).replace("slug: property-repair", "slug: renamed-repair");
    await rename(oldPath, nextPath);
    await writeFile(path.join(nextPath, "chain.yml"), manifest);
    const index = await resolveArchiveResourceIndex({ archiveRoot: root });
    expect(index.chains.find((chain) => chain.resourceId === "22222222-2222-4222-8222-222222222222")?.slug).toBe("renamed-repair");
  });

  it("retains collection identity when its slug and member references are renamed", async () => {
    const root = await fixtureCopy();
    const archivePath = path.join(root, "archive.yml");
    await writeFile(archivePath, (await readFile(archivePath, "utf8")).replace("slug: household-projects", "slug: renamed-projects"));
    const chainPath = path.join(root, "property-repair", "chain.yml");
    await writeFile(chainPath, (await readFile(chainPath, "utf8")).replace("collection: household-projects", "collection: renamed-projects"));
    const index = await resolveArchiveResourceIndex({ archiveRoot: root });
    expect(index.collections.find((collection) => collection.resourceId === "11111111-1111-4111-8111-111111111111")?.slug).toBe("renamed-projects");
    expect(index.chains.find((chain) => chain.slug === "property-repair")?.collection).toBe("renamed-projects");
  });

  it("fails closed for duplicate IDs and excludes malformed memberships", async () => {
    const root = await fixtureCopy();
    const inventoryPath = path.join(root, "inventory-records", "chain.yml");
    await writeFile(inventoryPath, `slug: inventory-records\nresourceId: 22222222-2222-4222-8222-222222222222\ntitle: Duplicate\n`);
    await expect(resolveArchiveResourceIndex({ archiveRoot: root })).rejects.toBeInstanceOf(ResourceResolutionError);
  });

  it("resolves ungrouped chain resources when optional archive.yml is absent", async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), "resource-index-flat-"));
    await cp(path.resolve("examples/archive/chains/inventory-records"), path.join(root, "inventory-records"), { recursive: true });
    const index = await resolveArchiveResourceIndex({ archiveRoot: root });
    expect(index.collections).toEqual([]);
    expect(index.chains).toEqual([expect.objectContaining({ slug: "inventory-records", resourceId: "33333333-3333-4333-8333-333333333333" })]);
  });

  it("fails closed when archive.yml escapes through a symbolic link", async () => {
    const root = await fixtureCopy();
    const outside = path.join(await mkdtemp(path.join(os.tmpdir(), "resource-index-outside-")), "archive.yml");
    await writeFile(outside, await readFile(path.join(root, "archive.yml"), "utf8"));
    await unlink(path.join(root, "archive.yml"));
    await symlink(outside, path.join(root, "archive.yml"));

    await expect(resolveArchiveResourceIndex({ archiveRoot: root })).rejects.toMatchObject({
      code: "invalid-archive",
    });
  });

  it("excludes a chain whose manifest escapes through a symbolic link", async () => {
    const root = await fixtureCopy();
    const manifestPath = path.join(root, "property-repair", "chain.yml");
    const outside = path.join(await mkdtemp(path.join(os.tmpdir(), "resource-chain-outside-")), "chain.yml");
    await writeFile(outside, await readFile(manifestPath, "utf8"));
    await unlink(manifestPath);
    await symlink(outside, manifestPath);

    const index = await resolveArchiveResourceIndex({ archiveRoot: root });
    expect(index.chains.some((chain) => chain.slug === "property-repair")).toBe(false);
    expect(index.chains.some((chain) => chain.slug === "inventory-records")).toBe(true);
  });

  it("resolves a safely contained chain-directory symbolic link", async () => {
    const root = await fixtureCopy();
    const storage = path.join(root, ".chain-storage", "linked-chain");
    await cp(path.join(root, "inventory-records"), storage, { recursive: true });
    await writeFile(
      path.join(storage, "chain.yml"),
      (await readFile(path.join(storage, "chain.yml"), "utf8"))
        .replace("slug: inventory-records", "slug: linked-chain")
        .replace("33333333-3333-4333-8333-333333333333", "66666666-6666-4666-8666-666666666666"),
    );
    await symlink(storage, path.join(root, "linked-chain"));

    const index = await resolveArchiveResourceIndex({ archiveRoot: root });
    expect(index.chains).toEqual(expect.arrayContaining([
      expect.objectContaining({ slug: "linked-chain", resourceId: "66666666-6666-4666-8666-666666666666" }),
    ]));
  });
});
