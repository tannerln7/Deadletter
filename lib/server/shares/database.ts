import "server-only";

import { createHash, randomBytes, randomUUID, timingSafeEqual } from "node:crypto";
import { realpathSync, statSync } from "node:fs";
import { DatabaseSync } from "node:sqlite";
import path from "node:path";

import { getArchiveRoot } from "../archive-root.ts";

export const SHARE_DATABASE_VERSION = 1;

const SHARE_GRANTS_TABLE_SQL = `CREATE TABLE share_grants (
  id TEXT PRIMARY KEY,
  resource_kind TEXT NOT NULL CHECK (resource_kind IN ('chain', 'collection')),
  resource_id TEXT NOT NULL,
  token_digest BLOB NOT NULL CHECK (length(token_digest) = 32),
  created_at INTEGER NOT NULL,
  created_by_sub TEXT NOT NULL CHECK (length(created_by_sub) > 0),
  expires_at INTEGER,
  revoked_at INTEGER,
  credential_rotated_at INTEGER
) STRICT`;
const TOKEN_DIGEST_INDEX_SQL = "CREATE UNIQUE INDEX share_grants_token_digest ON share_grants(token_digest)";
const ACTIVE_RESOURCE_INDEX_SQL = `CREATE UNIQUE INDEX share_grants_one_active_resource
  ON share_grants(resource_kind, resource_id)
  WHERE revoked_at IS NULL`;

export type ShareResourceKind = "chain" | "collection";
export type ShareGrant = {
  id: string;
  resourceKind: ShareResourceKind;
  resourceId: string;
  tokenDigest: Uint8Array;
  createdAt: number;
  createdBySub: string;
  expiresAt: number | null;
  revokedAt: number | null;
  credentialRotatedAt: number | null;
};

export class ShareDatabaseUnavailableError extends Error {
  constructor() {
    super("Sharing is unavailable.");
    this.name = "ShareDatabaseUnavailableError";
  }
}

function databasePath(environment: NodeJS.ProcessEnv = process.env): string {
  const value = environment.ARCHIVE_SHARE_DB?.trim();
  if (!value || value === ":memory:") throw new ShareDatabaseUnavailableError();
  if (!path.isAbsolute(value)) throw new ShareDatabaseUnavailableError();
  const candidate = path.resolve(value);
  let physicalCandidate: string;
  try {
    physicalCandidate = realpathSync(candidate);
  } catch {
    try {
      physicalCandidate = path.join(realpathSync(path.dirname(candidate)), path.basename(candidate));
    } catch {
      throw new ShareDatabaseUnavailableError();
    }
  }
  const isWithin = (parent: string) => {
    let physicalParent: string;
    try { physicalParent = realpathSync(parent); } catch { physicalParent = path.resolve(parent); }
    const relative = path.relative(physicalParent, physicalCandidate);
    return relative === "" || (!relative.startsWith(`..${path.sep}`) && relative !== ".." && !path.isAbsolute(relative));
  };
  if (isWithin(process.cwd()) || isWithin(getArchiveRoot())) throw new ShareDatabaseUnavailableError();
  return candidate;
}

function normalizedSql(value: unknown): string {
  return typeof value === "string" ? value.replace(/\s+/g, " ").trim().replace(/;$/, "").toLowerCase() : "";
}

function validateShareSchema(database: DatabaseSync): void {
  const quickCheck = database.prepare("PRAGMA quick_check").get() as Record<string, unknown> | undefined;
  if (!quickCheck || Object.values(quickCheck)[0] !== "ok") throw new ShareDatabaseUnavailableError();

  const expected = new Map([
    ["table:share_grants", normalizedSql(SHARE_GRANTS_TABLE_SQL)],
    ["index:share_grants_token_digest", normalizedSql(TOKEN_DIGEST_INDEX_SQL)],
    ["index:share_grants_one_active_resource", normalizedSql(ACTIVE_RESOURCE_INDEX_SQL)],
  ]);
  const rows = database.prepare(`SELECT type, name, sql FROM sqlite_schema
    WHERE (type = 'table' AND name = 'share_grants')
       OR (type = 'index' AND name IN ('share_grants_token_digest', 'share_grants_one_active_resource'))`).all() as Record<string, unknown>[];
  for (const row of rows) {
    const key = `${String(row.type)}:${String(row.name)}`;
    const expectedSql = expected.get(key);
    if (!expectedSql || normalizedSql(row.sql) !== expectedSql) throw new ShareDatabaseUnavailableError();
    expected.delete(key);
  }
  if (rows.length !== 3 || expected.size !== 0) throw new ShareDatabaseUnavailableError();
}

function openDatabase(path = databasePath(), readOnly = true): DatabaseSync {
  try {
    if (!statSync(path).isFile()) throw new ShareDatabaseUnavailableError();
    const database = new DatabaseSync(path, { allowExtension: false, readOnly, timeout: 5_000 });
    database.enableLoadExtension(false);
    database.enableDefensive(true);
    database.exec("PRAGMA busy_timeout = 5000; PRAGMA foreign_keys = ON;");
    const version = Number((database.prepare("PRAGMA user_version").get() as { user_version: number }).user_version);
    if (version !== SHARE_DATABASE_VERSION) {
      database.close();
      throw new ShareDatabaseUnavailableError();
    }
    try {
      validateShareSchema(database);
    } catch {
      database.close();
      throw new ShareDatabaseUnavailableError();
    }
    return database;
  } catch (error) {
    if (error instanceof ShareDatabaseUnavailableError) throw error;
    throw new ShareDatabaseUnavailableError();
  }
}

export function initializeShareDatabase(path = databasePath()): void {
  const database = new DatabaseSync(path, { allowExtension: false, timeout: 5_000 });
  try {
    database.enableLoadExtension(false);
    database.exec("PRAGMA busy_timeout = 5000; PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON;");
    const current = Number((database.prepare("PRAGMA user_version").get() as { user_version: number }).user_version);
    if (current > SHARE_DATABASE_VERSION) throw new Error("Share database schema is newer than this application.");
    if (current === 0) {
      database.exec(`
        BEGIN IMMEDIATE;
        ${SHARE_GRANTS_TABLE_SQL};
        ${TOKEN_DIGEST_INDEX_SQL};
        ${ACTIVE_RESOURCE_INDEX_SQL};
        PRAGMA user_version = 1;
        COMMIT;
      `);
    }
    validateShareSchema(database);
    database.enableDefensive(true);
  } finally {
    database.close();
  }
}

function rowToGrant(row: Record<string, unknown> | undefined): ShareGrant | undefined {
  if (!row) return undefined;
  return {
    id: String(row.id),
    resourceKind: String(row.resource_kind) as ShareResourceKind,
    resourceId: String(row.resource_id),
    tokenDigest: row.token_digest as Uint8Array,
    createdAt: Number(row.created_at),
    createdBySub: String(row.created_by_sub),
    expiresAt: row.expires_at === null ? null : Number(row.expires_at),
    revokedAt: row.revoked_at === null ? null : Number(row.revoked_at),
    credentialRotatedAt: row.credential_rotated_at === null ? null : Number(row.credential_rotated_at),
  };
}

export function digestShareSecret(secret: string): Buffer {
  return createHash("sha256").update(secret, "utf8").digest();
}

export function generateShareSecret(): string {
  return randomBytes(32).toString("base64url");
}

export function isValidShareSecret(secret: string): boolean {
  return /^[A-Za-z0-9_-]{43}$/.test(secret);
}

export function credentialMatches(grant: ShareGrant, secret: string): boolean {
  if (!isValidShareSecret(secret)) return false;
  return timingSafeEqual(Buffer.from(grant.tokenDigest), digestShareSecret(secret));
}

export function findGrantById(id: string): ShareGrant | undefined {
  const database = openDatabase();
  try {
    return rowToGrant(database.prepare("SELECT * FROM share_grants WHERE id = ?").get(id) as Record<string, unknown> | undefined);
  } finally {
    database.close();
  }
}

export function findGrantBySecret(secret: string): ShareGrant | undefined {
  if (!isValidShareSecret(secret)) return undefined;
  const database = openDatabase();
  try {
    return rowToGrant(database.prepare("SELECT * FROM share_grants WHERE token_digest = ?").get(digestShareSecret(secret)) as Record<string, unknown> | undefined);
  } finally {
    database.close();
  }
}

export function findManagedGrant(kind: ShareResourceKind, resourceId: string): ShareGrant | undefined {
  const database = openDatabase();
  try {
    return rowToGrant(database.prepare("SELECT * FROM share_grants WHERE resource_kind = ? AND resource_id = ? AND revoked_at IS NULL").get(kind, resourceId) as Record<string, unknown> | undefined);
  } finally {
    database.close();
  }
}

export function grantIsActive(grant: ShareGrant, now = Math.floor(Date.now() / 1000)): boolean {
  return grant.revokedAt === null && (grant.expiresAt === null || grant.expiresAt > now);
}

export function createGrant(input: { resourceKind: ShareResourceKind; resourceId: string; createdBySub: string; expiresAt?: number | null }): { grant: ShareGrant; secret: string } {
  const database = openDatabase(databasePath(), false);
  const secret = generateShareSecret();
  const now = Math.floor(Date.now() / 1000);
  const id = randomUUID();
  try {
    database.exec("BEGIN IMMEDIATE");
    database.prepare(`INSERT INTO share_grants
      (id, resource_kind, resource_id, token_digest, created_at, created_by_sub, expires_at, revoked_at, credential_rotated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, NULL, NULL)`).run(
        id, input.resourceKind, input.resourceId, digestShareSecret(secret), now, input.createdBySub, input.expiresAt ?? null,
      );
    database.exec("COMMIT");
  } catch (error) {
    try { database.exec("ROLLBACK"); } catch {}
    throw error;
  } finally {
    database.close();
  }
  return { grant: { id, resourceKind: input.resourceKind, resourceId: input.resourceId, tokenDigest: digestShareSecret(secret), createdAt: now, createdBySub: input.createdBySub, expiresAt: input.expiresAt ?? null, revokedAt: null, credentialRotatedAt: null }, secret };
}

export function regenerateGrant(id: string): { grant: ShareGrant; secret: string } | undefined {
  const database = openDatabase(databasePath(), false);
  const secret = generateShareSecret();
  const now = Math.floor(Date.now() / 1000);
  try {
    database.exec("BEGIN IMMEDIATE");
    const result = database.prepare("UPDATE share_grants SET token_digest = ?, credential_rotated_at = ? WHERE id = ? AND revoked_at IS NULL AND (expires_at IS NULL OR expires_at > ?)").run(digestShareSecret(secret), now, id, now);
    if (Number(result.changes) !== 1) { database.exec("ROLLBACK"); return undefined; }
    database.exec("COMMIT");
    return { grant: rowToGrant(database.prepare("SELECT * FROM share_grants WHERE id = ?").get(id) as Record<string, unknown>)!, secret };
  } catch (error) {
    try { database.exec("ROLLBACK"); } catch {}
    throw error;
  } finally {
    database.close();
  }
}

export function revokeGrant(id: string): boolean {
  const database = openDatabase(databasePath(), false);
  const now = Math.floor(Date.now() / 1000);
  try {
    database.exec("BEGIN IMMEDIATE");
    const result = database.prepare("UPDATE share_grants SET revoked_at = ? WHERE id = ? AND revoked_at IS NULL").run(now, id);
    database.exec("COMMIT");
    return Number(result.changes) === 1;
  } catch (error) {
    try { database.exec("ROLLBACK"); } catch {}
    throw error;
  } finally {
    database.close();
  }
}

export function revokeAllActiveGrants(): number {
  const database = openDatabase(databasePath(), false);
  const now = Math.floor(Date.now() / 1000);
  try {
    database.exec("BEGIN IMMEDIATE");
    const result = database.prepare("UPDATE share_grants SET revoked_at = ? WHERE revoked_at IS NULL").run(now);
    database.exec("COMMIT");
    return Number(result.changes);
  } catch (error) {
    try { database.exec("ROLLBACK"); } catch {}
    throw error;
  } finally {
    database.close();
  }
}
