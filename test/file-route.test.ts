import { mkdir, mkdtemp, symlink, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/server/security/private-access", () => ({
  PrivateAccessError: class PrivateAccessError extends Error {},
  requirePrivateAccess: vi.fn(async () => ({ sub: "test-sub" })),
}));

import { GET, HEAD } from "@/app/api/files/[chain]/[...path]/route";

type RouteContext = Parameters<typeof GET>[1];

function context(chain: string, segments: string[]): RouteContext {
  return { params: Promise.resolve({ chain, path: segments }) };
}

afterEach(() => vi.unstubAllEnvs());

describe("filesystem file route", () => {
  it("streams a safe file with content headers and supports HEAD", async () => {
    vi.stubEnv("ARCHIVE_DATA_DIR", path.resolve("examples/archive/chains"));
    const url = "http://localhost/api/files/property-repair/attachments/sanitized-repair-summary.pdf";
    const routeContext = context("property-repair", [
      "attachments",
      "sanitized-repair-summary.pdf",
    ]);
    const response = await GET(new Request(url), routeContext);
    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toBe("application/pdf");
    expect(response.headers.get("content-disposition")).toMatch(/^inline;/);
    expect(await response.text()).toMatch(/^%PDF-1\.4/);

    const head = await HEAD(new Request(url), routeContext);
    expect(head.status).toBe(200);
    expect(Number(head.headers.get("content-length"))).toBeGreaterThan(100);
    expect(await head.text()).toBe("");
  });

  it("forces download for an inline-safe type when download=1", async () => {
    vi.stubEnv("ARCHIVE_DATA_DIR", path.resolve("examples/archive/chains"));
    const response = await GET(
      new Request("http://localhost/api/files/inventory-records/attachments/inventory-notes.txt?download=1"),
      context("inventory-records", ["attachments", "inventory-notes.txt"]),
    );
    expect(response.headers.get("content-disposition")).toMatch(/^attachment;/);
    await response.body?.cancel();
  });

  it("forces HTML to download and sets nosniff", async () => {
    const archiveRoot = await mkdtemp(path.join(os.tmpdir(), "claim-route-"));
    const chain = path.join(archiveRoot, "safe-chain");
    await mkdir(path.join(chain, "attachments"), { recursive: true });
    await writeFile(path.join(chain, "chain.yml"), "slug: safe-chain\ntitle: Safe chain\n");
    await writeFile(path.join(chain, "attachments", "page.html"), "<p>sanitized fixture</p>");
    vi.stubEnv("ARCHIVE_DATA_DIR", archiveRoot);

    const response = await GET(
      new Request("http://localhost/api/files/safe-chain/attachments/page.html"),
      context("safe-chain", ["attachments", "page.html"]),
    );
    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toBe("text/html");
    expect(response.headers.get("content-disposition")).toMatch(/^attachment;/);
    expect(response.headers.get("x-content-type-options")).toBe("nosniff");
    await response.body?.cancel();
  });

  it("returns forbidden for a symbolic-link escape", async () => {
    const testRoot = await mkdtemp(path.join(os.tmpdir(), "claim-route-symlink-"));
    const archiveRoot = path.join(testRoot, "archive");
    const chain = path.join(archiveRoot, "safe-chain");
    await mkdir(path.join(chain, "attachments"), { recursive: true });
    await writeFile(path.join(chain, "chain.yml"), "slug: safe-chain\ntitle: Safe chain\n");
    await writeFile(path.join(testRoot, "private.txt"), "outside");
    await symlink(path.join(testRoot, "private.txt"), path.join(chain, "attachments", "escape.txt"));
    vi.stubEnv("ARCHIVE_DATA_DIR", archiveRoot);

    const response = await GET(
      new Request("http://localhost/api/files/safe-chain/attachments/escape.txt"),
      context("safe-chain", ["attachments", "escape.txt"]),
    );
    expect(response.status).toBe(403);
    expect(await response.json()).toEqual({ error: "Archive file access is not allowed." });
  });

  it.each([
    ["property-repair", ["%2e%2e", "outside.txt"], 400],
    ["invalid/chain", ["attachments", "file.txt"], 400],
    ["not-present", ["attachments", "file.txt"], 404],
  ])("returns a safe status for invalid or missing paths", async (chain, segments, status) => {
    vi.stubEnv("ARCHIVE_DATA_DIR", path.resolve("examples/archive/chains"));
    const response = await GET(
      new Request("http://localhost/api/files/example/file"),
      context(chain, segments),
    );
    expect(response.status).toBe(status);
    expect(await response.json()).toEqual({
      error:
        status === 400
          ? "Invalid archive path."
          : status === 403
            ? "Archive file access is not allowed."
            : "Archive file not found.",
    });
  });
});
