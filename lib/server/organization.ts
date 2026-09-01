import "server-only";

import { readFile, realpath, stat } from "node:fs/promises";
import path from "node:path";
import matter from "gray-matter";

import { ARCHIVE_MANIFEST_FILENAME } from "./archive-layout";
import { getArchiveRoot, type ArchiveLocationOptions } from "./archive-root";
import { discoverChains } from "./chains";
import { describeValidationFailure } from "./errors";
import { isPathInside } from "./path-safety";
import { archiveManifestSchema } from "./schemas";
import type {
  ArchiveCategoryManifest,
  ArchiveChainSummary,
  ArchiveCollection,
  ArchiveCollectionManifest,
  ArchiveDiagnostic,
  ArchiveHierarchy,
  ArchiveOrganizationManifest,
} from "./types";

export { ARCHIVE_MANIFEST_FILENAME };

type OrganizationLoadResult = {
  manifest?: ArchiveOrganizationManifest;
  errors: ArchiveDiagnostic[];
};

function parseYamlDocument(source: string): unknown {
  return matter(`---\n${source}\n---`).data;
}

function invalidOrganization(message: string): OrganizationLoadResult {
  return {
    errors: [
      {
        code: "invalid-organization",
        message,
        sourceFile: ARCHIVE_MANIFEST_FILENAME,
      },
    ],
  };
}

export async function loadArchiveOrganization(
  options: ArchiveLocationOptions = {},
): Promise<OrganizationLoadResult> {
  const archiveRoot = getArchiveRoot(options);
  const requestedManifest = path.resolve(archiveRoot, ARCHIVE_MANIFEST_FILENAME);

  let realArchiveRoot: string;
  try {
    realArchiveRoot = await realpath(archiveRoot);
  } catch {
    return invalidOrganization("The archive organization could not be read.");
  }

  let manifestFile: string;
  try {
    manifestFile = await realpath(requestedManifest);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return { errors: [] };
    return invalidOrganization("The archive organization could not be read.");
  }

  if (!isPathInside(realArchiveRoot, manifestFile)) {
    return invalidOrganization("The archive organization is not safely contained in the archive.");
  }

  try {
    const manifestStats = await stat(manifestFile);
    if (!manifestStats.isFile()) {
      return invalidOrganization("The archive organization manifest is not a regular file.");
    }
  } catch {
    return invalidOrganization("The archive organization could not be read.");
  }

  let parsed: unknown;
  try {
    parsed = parseYamlDocument(await readFile(manifestFile, "utf8"));
  } catch {
    return invalidOrganization("The archive organization manifest is not valid YAML.");
  }

  const result = archiveManifestSchema.safeParse(parsed);
  if (!result.success) {
    return invalidOrganization(
      describeValidationFailure("archive organization", result.error.issues),
    );
  }

  return { manifest: result.data, errors: [] };
}

function compareOrganizationItems(
  left: ArchiveCollectionManifest | ArchiveCategoryManifest,
  right: ArchiveCollectionManifest | ArchiveCategoryManifest,
): number {
  return (
    (left.displayOrder ?? Number.POSITIVE_INFINITY) -
      (right.displayOrder ?? Number.POSITIVE_INFINITY) ||
    left.title.localeCompare(right.title) ||
    left.slug.localeCompare(right.slug)
  );
}

export function buildArchiveHierarchy(
  chains: Awaited<ReturnType<typeof discoverChains>>["chains"],
  organization: OrganizationLoadResult,
  chainErrors: readonly ArchiveDiagnostic[] = [],
): ArchiveHierarchy {
  if (!organization.manifest) {
    return {
      collections: [],
      ungrouped: [...chains],
      errors: [...chainErrors, ...organization.errors],
    };
  }

  const collections: ArchiveCollection[] = organization.manifest.collections
    .map((collection) => ({
      ...collection,
      chains: [],
      categories: [...(collection.categories ?? [])]
        .sort(compareOrganizationItems)
        .map((category) => ({ ...category, chains: [] })),
    }))
    .sort(compareOrganizationItems);
  const collectionsBySlug = new Map(collections.map((collection) => [collection.slug, collection]));
  const ungrouped: ArchiveChainSummary[] = [];
  const membershipErrors: ArchiveDiagnostic[] = [];

  for (const chain of chains) {
    if (!chain.collection) {
      ungrouped.push(chain);
      continue;
    }

    const collection = collectionsBySlug.get(chain.collection);
    if (!collection) {
      ungrouped.push(chain);
      membershipErrors.push({
        code: "unknown-organization-reference",
        chainSlug: chain.slug,
        sourceFile: "chain.yml",
        message: `Unknown collection reference: ${chain.collection}. The chain is shown as ungrouped.`,
      });
      continue;
    }

    if (!chain.category) {
      collection.chains.push(chain);
      continue;
    }

    const category = collection.categories.find((candidate) => candidate.slug === chain.category);
    if (!category) {
      ungrouped.push(chain);
      membershipErrors.push({
        code: "unknown-organization-reference",
        chainSlug: chain.slug,
        sourceFile: "chain.yml",
        message: `Unknown category reference: ${chain.category} in collection ${chain.collection}. The chain is shown as ungrouped.`,
      });
      continue;
    }

    category.chains.push(chain);
  }

  return {
    collections,
    ungrouped,
    errors: [...chainErrors, ...organization.errors, ...membershipErrors],
  };
}

export async function discoverArchiveHierarchy(
  options: ArchiveLocationOptions = {},
): Promise<ArchiveHierarchy> {
  const discovery = await discoverChains(options);
  const organization = await loadArchiveOrganization(options);
  return buildArchiveHierarchy(discovery.chains, organization, discovery.errors);
}
