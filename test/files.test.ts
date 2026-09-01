import { mkdir, mkdtemp, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { describe, expect, it } from "vitest";

import {
  buildContentDisposition,
  enumerateArchiveFiles,
  enumerateAttachments,
  getFileCategory,
  getMimeType,
  getSafeDisposition,
} from "@/lib/server/files";

const fixtureRoot = path.resolve("examples/archive/chains");

describe("attachment enumeration", () => {
  it("enumerates referenced files with relationship, size, MIME, and category", async () => {
    const files = await enumerateAttachments("property-repair", { archiveRoot: fixtureRoot });
    expect(files).toHaveLength(4);
    expect(files.find(({ file }) => file.endsWith(".pdf"))).toMatchObject({
      chainTitle: "Fictional Property Repair",
      emailSubject: expect.stringContaining("fictional repair scope"),
      type: "application/pdf",
      category: "pdf",
      size: expect.any(Number),
    });
    expect(files.find(({ file }) => file.endsWith(".png"))).toMatchObject({
      type: "image/png",
      category: "image",
      size: expect.any(Number),
    });
  });

  it("aggregates attachments across chains", async () => {
    const { files, errors } = await enumerateArchiveFiles({ archiveRoot: fixtureRoot });
    expect(errors).toEqual([]);
    expect(files).toHaveLength(5);
    expect(new Set(files.map(({ chainSlug }) => chainSlug))).toEqual(
      new Set(["property-repair", "inventory-records"]),
    );
  });

  it("fails a direct chain with a typed missing-attachment error", async () => {
    const archiveRoot = await mkdtemp(path.join(os.tmpdir(), "missing-attachment-"));
    const chain = path.join(archiveRoot, "safe-chain");
    await mkdir(path.join(chain, "emails"), { recursive: true });
    await writeFile(path.join(chain, "chain.yml"), "slug: safe-chain\ntitle: Safe chain\n");
    await writeFile(
      path.join(chain, "emails", "entry.md"),
      `---\nid: entry\nchain: safe-chain\ndate: 2026-01-01T12:00:00Z\nfrom: sender@example.test\nto: [recipient@example.test]\nsubject: Missing file\nattachments:\n  - title: Missing note\n    file: attachments/missing.txt\n    type: text/plain\n---\n\nBody.`,
    );
    await expect(enumerateAttachments("safe-chain", { archiveRoot })).rejects.toMatchObject({
      code: "missing-attachment",
      context: { chainSlug: "safe-chain", sourceFile: "entry.md" },
    });
  });
});

describe("MIME and disposition", () => {
  it.each([
    ["example.pdf", "application/pdf", "inline", "pdf"],
    ["example.png", "image/png", "inline", "image"],
    ["example.txt", "text/plain", "inline", "text"],
    ["example.html", "text/html", "attachment", "text"],
    ["example.docx", "application/vnd.openxmlformats-officedocument.wordprocessingml.document", "attachment", "office"],
    ["example.unknown-extension", "application/octet-stream", "attachment", "other"],
  ])("classifies %s", (file, expectedMime, disposition, category) => {
    const type = getMimeType(file);
    expect(type).toBe(expectedMime);
    expect(getSafeDisposition(type)).toBe(disposition);
    expect(getFileCategory(type, file)).toBe(category);
  });

  it("prevents filename header injection", () => {
    const header = buildContentDisposition("attachment", 'report"\r\nX-Evil: yes.html');
    expect(header).not.toContain("\r");
    expect(header).not.toContain("\n");
    expect(header).toMatch(/^attachment;/);
  });
});
