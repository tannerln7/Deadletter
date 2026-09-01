import { mkdir, mkdtemp, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { discoverChains, loadChain, loadChainManifest } from "@/lib/server/chains";
import { ArchiveError } from "@/lib/server/errors";

const fixtureRoot = path.resolve("examples/archive/chains");

describe("chain discovery", () => {
  it("loads manifests, entries, counts, and deterministic ordering", async () => {
    const discovery = await discoverChains({ archiveRoot: fixtureRoot });
    expect(discovery.errors).toEqual([]);
    expect(discovery.chains.map(({ slug }) => slug)).toEqual([
      "property-repair",
      "inventory-records",
    ]);
    expect(discovery.chains[0]).toMatchObject({ entryCount: 2, attachmentCount: 4 });
  });

  it("sorts email entries by metadata date rather than filename", async () => {
    const chain = await loadChain("property-repair", { archiveRoot: fixtureRoot });
    expect(chain.entries.map(({ id }) => id)).toEqual(["repair-summary", "repair-request"]);
  });

  it("returns a typed unknown-chain error", async () => {
    await expect(loadChain("not-present", { archiveRoot: fixtureRoot })).rejects.toMatchObject({
      code: "unknown-chain",
    });
  });

  it("distinguishes a missing archive root from an unknown chain", async () => {
    const testRoot = await mkdtemp(path.join(os.tmpdir(), "missing-archive-root-"));
    await expect(
      loadChain("not-present", {
        archiveRoot: path.join(testRoot, "does-not-exist"),
      }),
    ).rejects.toMatchObject({ code: "archive-not-found" });
  });

  it("validates a chain manifest", async () => {
    await expect(
      loadChainManifest("property-repair", { archiveRoot: fixtureRoot }),
    ).resolves.toMatchObject({ slug: "property-repair", displayOrder: 1 });
    await expect(loadChainManifest("NOT-VALID", { archiveRoot: fixtureRoot })).rejects.toBeInstanceOf(
      ArchiveError,
    );
  });

  it("excludes only an invalid chain and returns a visible-safe diagnostic", async () => {
    const archiveRoot = await mkdtemp(path.join(os.tmpdir(), "chain-discovery-"));
    const invalid = path.join(archiveRoot, "invalid-chain");
    await mkdir(path.join(invalid, "emails"), { recursive: true });
    await writeFile(path.join(invalid, "chain.yml"), "slug: invalid-chain\n");

    const discovery = await discoverChains({ archiveRoot });
    expect(discovery.chains).toEqual([]);
    expect(discovery.errors).toEqual([
      expect.objectContaining({
        code: "invalid-manifest",
        chainSlug: "invalid-chain",
        sourceFile: "chain.yml",
      }),
    ]);
    expect(discovery.errors[0]?.message).not.toContain(archiveRoot);
  });

  it("reports a missing chain manifest as invalid content", async () => {
    const archiveRoot = await mkdtemp(path.join(os.tmpdir(), "chain-manifest-"));
    await mkdir(path.join(archiveRoot, "missing-manifest"), { recursive: true });
    await expect(
      loadChainManifest("missing-manifest", { archiveRoot }),
    ).rejects.toMatchObject({ code: "invalid-manifest" });
  });
});
