import { describe, expect, it } from "vitest";

import {
  normalizeChainSortOrder,
  orderChainEntries,
} from "@/components/EmailChainViewer";
import type { ArchiveEmail } from "@/lib/server/types";

function entry(id: string): ArchiveEmail {
  return {
    id,
    chain: "example-chain",
    date: "2026-01-01T00:00:00-05:00",
    from: "Sender <sender@example.test>",
    to: ["Recipient <recipient@example.test>"],
    subject: id,
    attachments: [],
    body: id,
    sourceFile: `${id}.md`,
  };
}

describe("email chain display order", () => {
  it("defaults unknown and repeated query values to oldest first", () => {
    expect(normalizeChainSortOrder(undefined)).toBe("oldest");
    expect(normalizeChainSortOrder("unexpected")).toBe("oldest");
    expect(normalizeChainSortOrder(["newest", "oldest"])).toBe("oldest");
    expect(normalizeChainSortOrder("newest")).toBe("newest");
  });

  it("reverses only the display copy for newest-first order", () => {
    const entries = [entry("first"), entry("second"), entry("third")];

    expect(orderChainEntries(entries, "oldest").map(({ id }) => id)).toEqual([
      "first",
      "second",
      "third",
    ]);
    expect(orderChainEntries(entries, "newest").map(({ id }) => id)).toEqual([
      "third",
      "second",
      "first",
    ]);
    expect(entries.map(({ id }) => id)).toEqual(["first", "second", "third"]);
  });
});
