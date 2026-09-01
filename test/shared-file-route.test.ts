import { mkdtemp } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { afterEach, describe, expect, it, vi } from "vitest";

import { GET } from "@/app/shared/[grant]/files/[chain]/[...path]/route";
import { createGrant, initializeShareDatabase } from "@/lib/server/shares/database";
import { shareCookieName } from "@/lib/server/shares/access";

afterEach(() => vi.unstubAllEnvs());

async function setup() {
  const root = await mkdtemp(path.join(os.tmpdir(), "shared-file-"));
  vi.stubEnv("ARCHIVE_DATA_DIR", path.resolve("examples/archive/chains"));
  vi.stubEnv("ARCHIVE_SHARE_DB", path.join(root, "shares.sqlite"));
  vi.stubEnv("ARCHIVE_PRIVATE_ORIGIN", "https://archive.example.test");
  vi.stubEnv("ARCHIVE_SHARE_ORIGIN", "https://share.example.test");
  initializeShareDatabase();
  const created = createGrant({ resourceKind: "chain", resourceId: "22222222-2222-4222-8222-222222222222", createdBySub: "manager" });
  const headers = { host: "share.example.test", cookie: `${shareCookieName(created.grant.id)}=${created.secret}` };
  return { created, headers };
}

describe("shared file route", () => {
  it("streams a referenced attachment with revocation-safe headers", async () => {
    const { created, headers } = await setup();
    const segments = ["attachments", "sanitized-repair-summary.pdf"];
    const response = await GET(new Request(`https://share.example.test/shared/${created.grant.id}/files/property-repair/${segments.join("/")}`, { headers }), { params: Promise.resolve({ grant: created.grant.id, chain: "property-repair", path: segments }) });
    expect(response.status).toBe(200);
    expect(response.headers.get("content-disposition")).toMatch(/^inline;/);
    expect(response.headers.get("cache-control")).toContain("no-store");
    expect(response.headers.get("content-security-policy")).toBeNull();
    await response.body?.cancel();
  });

  it("rejects unreferenced files, unauthorized chains, and traversal", async () => {
    const { created, headers } = await setup();
    const call = (chain: string, segments: string[]) => GET(new Request(`https://share.example.test/shared/${created.grant.id}/files/${chain}/file`, { headers }), { params: Promise.resolve({ grant: created.grant.id, chain, path: segments }) });
    await expect(call("property-repair", ["chain.yml"])).resolves.toMatchObject({ status: 404 });
    await expect(call("inventory-records", ["attachments", "inventory-notes.txt"])).resolves.toMatchObject({ status: 404 });
    await expect(call("property-repair", ["%2e%2e", "outside.txt"])).resolves.toMatchObject({ status: 400 });
  });
});
