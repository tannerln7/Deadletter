import { describe, expect, it } from "vitest";
import { NextRequest } from "next/server";

import { classifyArchiveRequest, proxy } from "@/proxy";

const environment = { ARCHIVE_PRIVATE_ORIGIN: "https://archive.example.test", ARCHIVE_SHARE_ORIGIN: "https://share.example.test" };

describe("private/share host isolation", () => {
  it.each([
    ["archive.example.test", "/chains/example", "private"],
    ["archive.example.test", "/shared/grant", "deny"],
    ["share.example.test", "/shared/grant", "share"],
    ["share.example.test", "/s/token", "share"],
    ["share.example.test", "/chains/example", "deny"],
    ["unknown.example.test", "/shared/grant", "deny"],
    ["share.example.test", "/_next/static/chunk.js", "static"],
    ["share.example.test", "/_next/image", "deny"],
  ])("classifies %s %s as %s", (host, pathName, expected) => {
    expect(classifyArchiveRequest(host, pathName, environment)).toBe(expected);
  });

  it("does not accept a forwarded host as classification input", () => {
    expect(classifyArchiveRequest("origin.internal:3001", "/shared/grant", environment)).toBe("deny");
  });

  it("returns a generic rejection without an assertion and permits RSC requests with one", () => {
    const previous = { privateOrigin: process.env.ARCHIVE_PRIVATE_ORIGIN, shareOrigin: process.env.ARCHIVE_SHARE_ORIGIN };
    process.env.ARCHIVE_PRIVATE_ORIGIN = environment.ARCHIVE_PRIVATE_ORIGIN;
    process.env.ARCHIVE_SHARE_ORIGIN = environment.ARCHIVE_SHARE_ORIGIN;
    try {
      const denied = proxy(new NextRequest("https://archive.example.test/chains/example", { headers: { host: "archive.example.test" } }));
      expect(denied.status).toBe(404);
      const rsc = proxy(new NextRequest("https://archive.example.test/chains/example", { headers: { host: "archive.example.test", "cf-access-jwt-assertion": "present", rsc: "1" } }));
      expect(rsc.status).toBe(200);
    } finally {
      if (previous.privateOrigin === undefined) delete process.env.ARCHIVE_PRIVATE_ORIGIN; else process.env.ARCHIVE_PRIVATE_ORIGIN = previous.privateOrigin;
      if (previous.shareOrigin === undefined) delete process.env.ARCHIVE_SHARE_ORIGIN; else process.env.ARCHIVE_SHARE_ORIGIN = previous.shareOrigin;
    }
  });
});
