import { describe, expect, it } from "vitest";

import { ArchiveError } from "@/lib/server/errors";
import { parseEmailMarkdown, sortEmailsChronologically } from "@/lib/server/emails";
import type { ArchiveEmail } from "@/lib/server/types";

function email(id: string, date: string, sourceFile = `${id}.md`): ArchiveEmail {
  return {
    attachments: [],
    body: "Sanitized body.",
    chain: "property-repair",
    date,
    from: "sender@example.test",
    id,
    sourceFile,
    subject: id,
    to: ["recipient@example.test"],
  };
}

describe("email parsing and sorting", () => {
  it("parses gray-matter content without losing the required timezone", () => {
    const entry = parseEmailMarkdown(
      `---\nid: note\nchain: property-repair\ndate: 2026-06-25T10:44:00-04:00\nfrom: sender@example.test\nto:\n  - recipient@example.test\ncc:\n  - observer@example.test\nsubject: Sanitized note\n---\n\nReadable **content**.`,
      "note.md",
      "property-repair",
    );
    expect(entry).toMatchObject({
      date: "2026-06-25T10:44:00-04:00",
      cc: ["observer@example.test"],
      body: "Readable **content**.",
      attachments: [],
    });
  });

  it("fails a chain mismatch with a typed diagnostic", () => {
    expect(() =>
      parseEmailMarkdown(
        `---\nid: note\nchain: another-chain\ndate: 2026-06-25T10:44:00Z\nfrom: sender@example.test\nto: [recipient@example.test]\nsubject: Note\n---`,
        "note.md",
        "property-repair",
      ),
    ).toThrowError(ArchiveError);
  });

  it("sorts ascending without mutating input and uses deterministic ties", () => {
    const input = [
      email("later", "2026-06-25T12:00:00Z"),
      email("b", "2026-06-25T10:00:00Z", "z.md"),
      email("a", "2026-06-25T10:00:00Z", "a.md"),
    ];
    expect(sortEmailsChronologically(input).map(({ id }) => id)).toEqual(["a", "b", "later"]);
    expect(input.map(({ id }) => id)).toEqual(["later", "b", "a"]);
  });
});
