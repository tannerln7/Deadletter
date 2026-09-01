import { cp, mkdtemp, readFile, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { afterEach, describe, expect, it, vi } from "vitest";

import { createGrant, initializeShareDatabase, regenerateGrant, revokeGrant } from "@/lib/server/shares/database";
import { requireShareAccess, shareCookieName, ShareAccessError } from "@/lib/server/shares/access";

async function setup() {
  const root = await mkdtemp(path.join(os.tmpdir(), "share-access-"));
  const archive = path.join(root, "archive");
  await cp(path.resolve("examples/archive/chains"), archive, { recursive: true });
  vi.stubEnv("ARCHIVE_DATA_DIR", archive);
  vi.stubEnv("ARCHIVE_SHARE_DB", path.join(root, "shares.sqlite"));
  vi.stubEnv("ARCHIVE_PRIVATE_ORIGIN", "https://archive.example.test");
  vi.stubEnv("ARCHIVE_SHARE_ORIGIN", "https://share.example.test");
  initializeShareDatabase();
  return { archive };
}

afterEach(() => vi.unstubAllEnvs());

describe("share authorization", () => {
  it("requires host, active grant, current credential, and current collection membership", async () => {
    const { archive } = await setup();
    const created = createGrant({ resourceKind: "collection", resourceId: "11111111-1111-4111-8111-111111111111", createdBySub: "manager" });
    const headers = new Headers({ host: "share.example.test", cookie: `${shareCookieName(created.grant.id)}=${created.secret}` });
    await expect(requireShareAccess({ grantId: created.grant.id, chainSlug: "property-repair", headers })).resolves.toMatchObject({ resource: { kind: "collection" } });
    await expect(requireShareAccess({ grantId: created.grant.id, chainSlug: "inventory-records", headers })).rejects.toBeInstanceOf(ShareAccessError);
    const inventoryPath = path.join(archive, "inventory-records", "chain.yml");
    await writeFile(inventoryPath, `${await readFile(inventoryPath, "utf8")}collection: household-projects\ncategory: repairs\n`);
    await expect(requireShareAccess({ grantId: created.grant.id, chainSlug: "inventory-records", headers })).resolves.toBeDefined();
    await expect(requireShareAccess({ grantId: created.grant.id, headers: new Headers({ host: "archive.example.test", cookie: headers.get("cookie")! }) })).rejects.toBeInstanceOf(ShareAccessError);

    const manifestPath = path.join(archive, "property-repair", "chain.yml");
    await writeFile(manifestPath, (await readFile(manifestPath, "utf8")).replace("collection: household-projects", "collection: missing"));
    await expect(requireShareAccess({ grantId: created.grant.id, chainSlug: "property-repair", headers })).rejects.toBeInstanceOf(ShareAccessError);
  });

  it("removes a chain from live collection scope when its category definition disappears", async () => {
    const { archive } = await setup();
    const created = createGrant({ resourceKind: "collection", resourceId: "11111111-1111-4111-8111-111111111111", createdBySub: "manager" });
    const headers = new Headers({ host: "share.example.test", cookie: `${shareCookieName(created.grant.id)}=${created.secret}` });
    const archivePath = path.join(archive, "archive.yml");
    await writeFile(archivePath, (await readFile(archivePath, "utf8")).replace(/    categories:[\s\S]*$/, ""));
    await expect(requireShareAccess({ grantId: created.grant.id, chainSlug: "property-repair", headers })).rejects.toBeInstanceOf(ShareAccessError);
  });

  it("invalidates old credentials on rotation and all credentials on revoke", async () => {
    await setup();
    const created = createGrant({ resourceKind: "chain", resourceId: "22222222-2222-4222-8222-222222222222", createdBySub: "manager" });
    const base = { grantId: created.grant.id, headers: new Headers({ host: "share.example.test" }) };
    await expect(requireShareAccess({ ...base, cookieValue: created.secret })).resolves.toBeDefined();
    const rotated = regenerateGrant(created.grant.id)!;
    await expect(requireShareAccess({ ...base, cookieValue: created.secret })).rejects.toBeInstanceOf(ShareAccessError);
    await expect(requireShareAccess({ ...base, cookieValue: rotated.secret })).resolves.toBeDefined();
    revokeGrant(created.grant.id);
    await expect(requireShareAccess({ ...base, cookieValue: rotated.secret })).rejects.toBeInstanceOf(ShareAccessError);
  });

  it("supports multiple simultaneous grant cookies without one replacing another", async () => {
    await setup();
    const first = createGrant({ resourceKind: "chain", resourceId: "22222222-2222-4222-8222-222222222222", createdBySub: "manager" });
    const second = createGrant({ resourceKind: "chain", resourceId: "33333333-3333-4333-8333-333333333333", createdBySub: "manager" });
    const headers = new Headers({
      host: "share.example.test",
      cookie: `${shareCookieName(first.grant.id)}=${first.secret}; ${shareCookieName(second.grant.id)}=${second.secret}`,
    });
    await expect(requireShareAccess({ grantId: first.grant.id, chainSlug: "property-repair", headers })).resolves.toBeDefined();
    await expect(requireShareAccess({ grantId: second.grant.id, chainSlug: "inventory-records", headers })).resolves.toBeDefined();
  });

  it("does not let a malformed unrelated chain break a healthy direct chain grant", async () => {
    const { archive } = await setup();
    await writeFile(path.join(archive, "inventory-records", "chain.yml"), "not: a supported manifest\n");
    const created = createGrant({ resourceKind: "chain", resourceId: "22222222-2222-4222-8222-222222222222", createdBySub: "manager" });
    await expect(requireShareAccess({ grantId: created.grant.id, chainSlug: "property-repair", headers: new Headers({ host: "share.example.test", cookie: `${shareCookieName(created.grant.id)}=${created.secret}` }) })).resolves.toBeDefined();
  });
});
