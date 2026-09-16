import { readFile } from "node:fs/promises";
import path from "node:path";

import matter from "gray-matter";
import { describe, expect, it } from "vitest";

import { discoverChains, loadChain } from "@/lib/server/chains";
import { parseEmailMarkdown } from "@/lib/server/emails";
import { enumerateAttachments } from "@/lib/server/files";
import { discoverArchiveHierarchy } from "@/lib/server/organization";
import { resolveSafeArchiveFile } from "@/lib/server/path-safety";
import {
  attachmentSchema,
  archiveManifestSchema,
  chainManifestSchema,
  relativeAttachmentPathSchema,
} from "@/lib/server/schemas";

const specificationPath = path.resolve("docs/archive-content-format.md");
const templateRoot = path.resolve("examples/archive-template");

async function readSpecification(): Promise<string> {
  return readFile(specificationPath, "utf8");
}

function markedExample(specification: string, label: string): string {
  const pattern = new RegExp(
    `<!-- contract-example:${label} -->\\s*\`\`\`(?:yaml|markdown|text)\\n([\\s\\S]*?)\\n\`\`\``,
  );
  const match = pattern.exec(specification);
  if (!match?.[1]) throw new Error(`Missing contract example: ${label}`);
  return match[1];
}

function yamlMapping(source: string): Record<string, unknown> {
  return matter(`---\n${source}\n---`).data;
}

describe("archive content format specification", () => {
  it("keeps every YAML and email frontmatter example parseable", async () => {
    const specification = await readSpecification();
    const yamlBlocks = [...specification.matchAll(/```yaml\n([\s\S]*?)\n```/g)];
    const markdownBlocks = [...specification.matchAll(/```markdown\n([\s\S]*?)\n```/g)];

    expect(yamlBlocks.length).toBeGreaterThan(0);
    expect(markdownBlocks.length).toBeGreaterThan(0);

    for (const [, yaml] of yamlBlocks) {
      expect(() => yamlMapping(yaml)).not.toThrow();
    }

    for (const [index, match] of markdownBlocks.entries()) {
      const markdown = match[1];
      const chain = matter(markdown).data.chain;
      expect(typeof chain).toBe("string");
      expect(() => parseEmailMarkdown(markdown, `documented-${index}.md`, chain)).not.toThrow();
    }
  });

  it("validates the documented schema-specific examples", async () => {
    const specification = await readSpecification();
    const manifests = [
      markedExample(specification, "chain-manifest"),
      markedExample(specification, "template-chain-manifest"),
    ];

    for (const manifest of manifests) {
      expect(() => chainManifestSchema.parse(yamlMapping(manifest))).not.toThrow();
    }

    expect(() =>
      archiveManifestSchema.parse(yamlMapping(markedExample(specification, "archive-manifest"))),
    ).not.toThrow();

    const attachment = attachmentSchema.parse(
      yamlMapping(markedExample(specification, "attachment")),
    );
    expect(() => relativeAttachmentPathSchema.parse(attachment.file)).not.toThrow();
  });

  it("discovers, sorts, and safely resolves the committed template", async () => {
    const discovery = await discoverChains({ archiveRoot: templateRoot });
    expect(discovery.errors).toEqual([]);
    expect(discovery.chains).toEqual([
      expect.objectContaining({
        slug: "example-chain",
        entryCount: 2,
        attachmentCount: 2,
      }),
    ]);

    const hierarchy = await discoverArchiveHierarchy({ archiveRoot: templateRoot });
    expect(hierarchy.errors).toEqual([]);
    expect(hierarchy.collections[0]?.categories[0]?.chains).toEqual([
      expect.objectContaining({ slug: "example-chain" }),
    ]);

    const chain = await loadChain("example-chain", { archiveRoot: templateRoot });
    expect(chain.entries.map(({ id }) => id)).toEqual([
      "example-message",
      "example-with-attachments",
    ]);

    const attachments = await enumerateAttachments("example-chain", {
      archiveRoot: templateRoot,
    });
    expect(attachments).toHaveLength(2);

    for (const attachment of attachments) {
      await expect(
        resolveSafeArchiveFile(
          templateRoot,
          "example-chain",
          attachment.file.split("/"),
        ),
      ).resolves.toMatchObject({ relativePath: attachment.file });
    }
  });

  it("links the canonical specification from repository entry points", async () => {
    const [readme, development] = await Promise.all([
      readFile(path.resolve("README.md"), "utf8"),
      readFile(path.resolve("DEVELOPMENT.md"), "utf8"),
    ]);

    expect(readme).toContain("[Archive Content Format Specification](docs/archive-content-format.md)");
    expect(development).toContain(
      "[Archive Content Format Specification](docs/archive-content-format.md)",
    );
    expect(readme).toContain(
      "[Agent-assisted imports](docs/agent-assisted-imports.md)",
    );
    expect(development).toContain(
      "[Agent-assisted imports](docs/agent-assisted-imports.md)",
    );

    const importGuide = await readFile(
      path.resolve("docs/agent-assisted-imports.md"),
      "utf8",
    );
    expect(importGuide).toContain(
      "[`import-email-export` skill](../.github/skills/import-email-export/SKILL.md)",
    );
    expect(importGuide).toContain(
      "[Archive Content Format Specification](archive-content-format.md)",
    );

    await expect(readFile(specificationPath, "utf8")).resolves.toContain(
      "# Archive Content Format Specification",
    );
  });
});
