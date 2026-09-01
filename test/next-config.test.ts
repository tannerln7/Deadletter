import { describe, expect, it } from "vitest";

import nextConfig, { getAllowedDevOrigins } from "@/next.config";

describe("Next.js development origins", () => {
  it("allows loopback without publishing installation-specific development hosts", () => {
    expect(nextConfig.allowedDevOrigins).toEqual(["127.0.0.1"]);
  });

  it("adds configured reverse-proxy hosts without schemes, ports, blanks, or duplicates", () => {
    expect(
      getAllowedDevOrigins(
        "deadletter.example.test, *.archive.example.test, deadletter.example.test, ",
      ),
    ).toEqual([
      "127.0.0.1",
      "deadletter.example.test",
      "*.archive.example.test",
    ]);
  });

  it("does not apply page framing CSP to shared attachment routes", async () => {
    const rules = await nextConfig.headers!();
    const catchAll = rules.find((rule) => rule.source === "/shared/:path*");
    expect(catchAll?.headers.some((header) => header.key === "Content-Security-Policy")).toBe(false);
    expect(rules.filter((rule) => rule.headers.some((header) => header.key === "Content-Security-Policy")).map((rule) => rule.source)).toEqual([
      "/shared/:grant",
      "/shared/:grant/categories/:category",
      "/shared/:grant/chains/:chain",
    ]);
  });
});
