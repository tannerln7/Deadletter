import { mkdtemp } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { afterEach, describe, expect, it, vi } from "vitest";

import { GET } from "@/app/s/[secret]/route";
import { createGrant, initializeShareDatabase } from "@/lib/server/shares/database";

afterEach(() => vi.unstubAllEnvs());

describe("share token exchange", () => {
  it("moves the secret into a scoped secure cookie and a tokenless redirect", async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), "share-exchange-"));
    vi.stubEnv("ARCHIVE_SHARE_DB", path.join(root, "shares.sqlite"));
    vi.stubEnv("ARCHIVE_PRIVATE_ORIGIN", "https://archive.example.test");
    vi.stubEnv("ARCHIVE_SHARE_ORIGIN", "https://share.example.test");
    initializeShareDatabase();
    const created = createGrant({ resourceKind: "chain", resourceId: "resource", createdBySub: "manager" });
    const response = await GET(new Request(`https://share.example.test/s/${created.secret}`, { headers: { host: "share.example.test" } }), { params: Promise.resolve({ secret: created.secret }) });
    expect(response.status).toBe(303);
    expect(response.headers.get("location")).toBe(`https://share.example.test/shared/${created.grant.id}`);
    expect(response.headers.get("location")).not.toContain(created.secret);
    const cookie = response.headers.get("set-cookie")!;
    expect(cookie).toContain(`__Secure-share_${created.grant.id}=`);
    expect(cookie).toContain(`Path=/shared/${created.grant.id}`);
    expect(cookie).toContain("HttpOnly");
    expect(cookie).toContain("Secure");
    expect(cookie).toContain("SameSite=lax");
    expect(await response.text()).not.toContain(created.secret);
    for (const [name, value] of response.headers) {
      if (!name.toLowerCase().includes("set-cookie")) expect(value).not.toContain(created.secret);
    }
  });
});
