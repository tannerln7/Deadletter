import { access, mkdir, mkdtemp, symlink } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";

import { afterEach, describe, expect, it, vi } from "vitest";

import {
  createGrant,
  credentialMatches,
  findGrantById,
  findManagedGrant,
  grantIsActive,
  initializeShareDatabase,
  regenerateGrant,
  revokeGrant,
  ShareDatabaseUnavailableError,
} from "@/lib/server/shares/database";

async function database() {
  const root = await mkdtemp(path.join(os.tmpdir(), "share-db-"));
  const file = path.join(root, "shares.sqlite");
  vi.stubEnv("ARCHIVE_SHARE_DB", file);
  initializeShareDatabase();
  return file;
}

afterEach(() => vi.unstubAllEnvs());

describe("SQLite share grants", () => {
  it("creates, rotates, revokes, and permits a new grant after revoke", async () => {
    await database();
    const first = createGrant({ resourceKind: "chain", resourceId: "resource-one", createdBySub: "manager-sub" });
    expect(first.secret).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(credentialMatches(first.grant, first.secret)).toBe(true);
    expect(findManagedGrant("chain", "resource-one")?.id).toBe(first.grant.id);
    expect(() => createGrant({ resourceKind: "chain", resourceId: "resource-one", createdBySub: "manager-sub" })).toThrow();

    const rotated = regenerateGrant(first.grant.id)!;
    expect(rotated.grant.id).toBe(first.grant.id);
    expect(credentialMatches(rotated.grant, first.secret)).toBe(false);
    expect(credentialMatches(rotated.grant, rotated.secret)).toBe(true);
    expect(revokeGrant(first.grant.id)).toBe(true);
    expect(grantIsActive(findGrantById(first.grant.id)!)).toBe(false);
    expect(() => createGrant({ resourceKind: "chain", resourceId: "resource-one", createdBySub: "manager-sub" })).not.toThrow();
  });

  it("enforces expiry and fails closed for missing or mismatched schemas", async () => {
    await database();
    const expired = createGrant({ resourceKind: "collection", resourceId: "resource-two", createdBySub: "manager-sub", expiresAt: Math.floor(Date.now() / 1000) - 1 });
    expect(grantIsActive(expired.grant)).toBe(false);
    vi.stubEnv("ARCHIVE_SHARE_DB", path.join(os.tmpdir(), "definitely-missing", "shares.sqlite"));
    expect(() => findGrantById(expired.grant.id)).toThrow(ShareDatabaseUnavailableError);

    const mismatchRoot = await mkdtemp(path.join(os.tmpdir(), "share-db-mismatch-"));
    const mismatchPath = path.join(mismatchRoot, "shares.sqlite");
    const raw = new DatabaseSync(mismatchPath);
    raw.exec("PRAGMA user_version = 99");
    raw.close();
    vi.stubEnv("ARCHIVE_SHARE_DB", mismatchPath);
    expect(() => findGrantById(expired.grant.id)).toThrow(ShareDatabaseUnavailableError);
  });

  it("rejects a version-matching database whose schema invariants are missing", async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), "share-db-invalid-schema-"));
    const file = path.join(root, "shares.sqlite");
    const raw = new DatabaseSync(file);
    raw.exec("CREATE TABLE share_grants (id TEXT PRIMARY KEY) STRICT; PRAGMA user_version = 1");
    raw.close();
    vi.stubEnv("ARCHIVE_SHARE_DB", file);

    expect(() => initializeShareDatabase()).toThrow(ShareDatabaseUnavailableError);
    expect(() => findGrantById("anything")).toThrow(ShareDatabaseUnavailableError);
  });

  it("does not create a missing database during normal grant access", async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), "share-db-absent-"));
    const file = path.join(root, "shares.sqlite");
    vi.stubEnv("ARCHIVE_SHARE_DB", file);

    expect(() => findGrantById("anything")).toThrow(ShareDatabaseUnavailableError);
    await expect(access(file)).rejects.toMatchObject({ code: "ENOENT" });
  });

  it("rejects repository-relative and archive-contained database paths", () => {
    vi.stubEnv("ARCHIVE_SHARE_DB", "shares.sqlite");
    expect(() => initializeShareDatabase()).toThrow(ShareDatabaseUnavailableError);
    vi.stubEnv("ARCHIVE_SHARE_DB", path.resolve("data/chains/shares.sqlite"));
    expect(() => initializeShareDatabase()).toThrow(ShareDatabaseUnavailableError);
  });

  it("rejects a database symlink that physically resolves inside the archive", async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), "share-db-symlink-"));
    const archive = path.join(root, "archive");
    await mkdir(archive);
    const inside = path.join(archive, "shares.sqlite");
    new DatabaseSync(inside).close();
    const alias = path.join(root, "shares.sqlite");
    await symlink(inside, alias);
    vi.stubEnv("ARCHIVE_DATA_DIR", archive);
    vi.stubEnv("ARCHIVE_SHARE_DB", alias);

    expect(() => initializeShareDatabase()).toThrow(ShareDatabaseUnavailableError);
  });
});
