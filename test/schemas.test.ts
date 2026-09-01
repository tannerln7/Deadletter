import { describe, expect, it } from "vitest";

import {
  archiveManifestSchema,
  attachmentSchema,
  chainManifestSchema,
  emailFrontmatterSchema,
  shareReadyArchiveManifestSchema,
  shareReadyChainManifestSchema,
} from "@/lib/server/schemas";

describe("archive schemas", () => {
  it("accepts the documented manifest and attachment fields", () => {
    expect(
      chainManifestSchema.parse({
        slug: "property-repair",
        title: "Fictional property repair",
        description: "Sanitized example.",
        displayOrder: 10,
      }),
    ).toMatchObject({ slug: "property-repair", displayOrder: 10 });

    expect(
      attachmentSchema.parse({
        title: "Summary",
        file: "attachments/nested/summary.pdf",
        type: "application/pdf",
      }),
    ).toMatchObject({ file: "attachments/nested/summary.pdf" });
  });

  it("rejects unsupported legacy manifest fields", () => {
    expect(() =>
      chainManifestSchema.parse({ slug: "property-repair", title: "Repair", sortOrder: 1 }),
    ).toThrow();
  });

  it("accepts organization membership and requires a collection for a category", () => {
    expect(
      chainManifestSchema.parse({
        slug: "property-repair",
        title: "Repair",
        collection: "household-projects",
        category: "repairs",
      }),
    ).toMatchObject({ collection: "household-projects", category: "repairs" });

    expect(() =>
      chainManifestSchema.parse({
        slug: "property-repair",
        title: "Repair",
        category: "repairs",
      }),
    ).toThrow(/category requires a collection/i);
  });

  it("rejects duplicate organization slugs deterministically", () => {
    expect(() =>
      archiveManifestSchema.parse({
        collections: [
          { slug: "records", title: "First" },
          { slug: "records", title: "Second" },
        ],
      }),
    ).toThrow(/duplicate collection slug/i);

    expect(() =>
      archiveManifestSchema.parse({
        collections: [
          {
            slug: "records",
            title: "Records",
            categories: [
              { slug: "letters", title: "First" },
              { slug: "letters", title: "Second" },
            ],
          },
        ],
      }),
    ).toThrow(/duplicate category slug/i);
  });

  it("requires a timestamp with timezone information", () => {
    const base = {
      id: "entry",
      chain: "property-repair",
      from: "sender@example.test",
      to: ["recipient@example.test"],
      subject: "Example",
    };
    expect(() => emailFrontmatterSchema.parse({ ...base, date: "2026-06-25T10:44:00" })).toThrow();
    expect(
      emailFrontmatterSchema.parse({ ...base, date: "2026-06-25T10:44:00-04:00" }),
    ).toMatchObject({ date: "2026-06-25T10:44:00-04:00" });
  });

  it("keeps missing resource IDs migration-compatible but requires them for sharing", () => {
    expect(chainManifestSchema.safeParse({ slug: "legacy", title: "Legacy" }).success).toBe(true);
    expect(shareReadyChainManifestSchema.safeParse({ slug: "legacy", title: "Legacy" }).success).toBe(false);
    expect(shareReadyChainManifestSchema.safeParse({ slug: "ready", title: "Ready", resourceId: "22222222-2222-4222-8222-222222222222" }).success).toBe(true);
    expect(shareReadyArchiveManifestSchema.safeParse({ collections: [{ slug: "legacy", title: "Legacy" }] }).success).toBe(false);
  });

  it.each([
    "../outside.pdf",
    "/etc/passwd",
    "attachments//file.txt",
    "attachments/%2e%2e/file.txt",
    "attachments/%252e%252e/file.txt",
  ])(
    "rejects unsafe attachment path %s",
    (file) => {
      expect(() =>
        attachmentSchema.parse({ title: "Unsafe", file, type: "text/plain" }),
      ).toThrow();
    },
  );
});
