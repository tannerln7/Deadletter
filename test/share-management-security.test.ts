import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/server/security/private-access", () => ({
  requireShareManager: vi.fn(async () => ({ sub: "manager-sub" })),
}));

import { requireManagementMutation } from "@/lib/server/shares/management";

beforeEach(() => {
  vi.stubEnv("ARCHIVE_PRIVATE_ORIGIN", "https://archive.example.test");
  vi.stubEnv("ARCHIVE_SHARE_ORIGIN", "https://share.example.test");
});

function request(headers: Record<string, string>) {
  return new Request("https://archive.example.test/api/shares", { method: "POST", headers, body: "{}" });
}

describe("share management request boundary", () => {
  it("accepts exact same-origin JSON requests with the project header", async () => {
    await expect(requireManagementMutation(request({ host: "archive.example.test", origin: "https://archive.example.test", "content-type": "application/json", "x-archive-request": "share-management", "sec-fetch-site": "same-origin" }))).resolves.toMatchObject({ sub: "manager-sub" });
  });

  it.each([
    ["wrong host", { host: "share.example.test", origin: "https://archive.example.test", "content-type": "application/json", "x-archive-request": "share-management" }],
    ["missing origin", { host: "archive.example.test", "content-type": "application/json", "x-archive-request": "share-management" }],
    ["wrong origin", { host: "archive.example.test", origin: "https://evil.example.test", "content-type": "application/json", "x-archive-request": "share-management" }],
    ["wrong type", { host: "archive.example.test", origin: "https://archive.example.test", "content-type": "text/plain", "x-archive-request": "share-management" }],
    ["missing custom header", { host: "archive.example.test", origin: "https://archive.example.test", "content-type": "application/json" }],
    ["cross site", { host: "archive.example.test", origin: "https://archive.example.test", "content-type": "application/json", "x-archive-request": "share-management", "sec-fetch-site": "cross-site" }],
  ])("rejects %s", async (_label, headers) => {
    await expect(requireManagementMutation(request(headers))).rejects.toThrow();
  });
});
