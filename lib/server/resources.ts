import "server-only";

import { readdir } from "node:fs/promises";

import { getArchiveRoot, type ArchiveLocationOptions } from "./archive-root";
import { loadChainManifest } from "./chains";
import { loadArchiveOrganization } from "./organization";

export type ResolvedChainResource = {
  kind: "chain";
  resourceId: string;
  slug: string;
  collection?: string;
  category?: string;
};

export type ResolvedCollectionResource = {
  kind: "collection";
  resourceId: string;
  slug: string;
  title: string;
  categories: ReadonlySet<string>;
  categoryTitles: ReadonlyMap<string, string>;
};

export type ArchiveResourceIndex = {
  collections: ResolvedCollectionResource[];
  chains: ResolvedChainResource[];
};

export class ResourceResolutionError extends Error {
  constructor(public readonly code: "invalid-archive" | "duplicate-id" | "not-found") {
    super(code === "not-found" ? "Archive resource not found." : "Archive resources cannot be safely resolved.");
    this.name = "ResourceResolutionError";
  }
}

export async function resolveArchiveResourceIndex(
  options: ArchiveLocationOptions = {},
): Promise<ArchiveResourceIndex> {
  const root = getArchiveRoot(options);
  const organization = await loadArchiveOrganization(options);
  if (organization.errors.length > 0) {
    throw new ResourceResolutionError("invalid-archive");
  }
  if (organization.manifest?.collections.some((collection) => !collection.resourceId)) {
    throw new ResourceResolutionError("invalid-archive");
  }

  const collections = (organization.manifest?.collections ?? []).map((collection) => ({
    kind: "collection" as const,
    resourceId: collection.resourceId!,
    slug: collection.slug,
    title: collection.title,
    categories: new Set(collection.categories?.map((category) => category.slug) ?? []),
    categoryTitles: new Map(collection.categories?.map((category) => [category.slug, category.title]) ?? []),
  }));
  const collectionBySlug = new Map(collections.map((collection) => [collection.slug, collection]));

  let directories;
  try {
    directories = await readdir(root, { withFileTypes: true });
  } catch {
    throw new ResourceResolutionError("invalid-archive");
  }

  const chains: ResolvedChainResource[] = [];
  for (const directory of directories.filter((entry) => (entry.isDirectory() || entry.isSymbolicLink()) && !entry.name.startsWith("."))) {
    try {
      const manifest = await loadChainManifest(directory.name, options);
      if (!manifest.resourceId) continue;
      if (manifest.collection) {
        const collection = collectionBySlug.get(manifest.collection);
        if (!collection || (manifest.category && !collection.categories.has(manifest.category))) continue;
      }
      chains.push({
        kind: "chain",
        resourceId: manifest.resourceId,
        slug: manifest.slug,
        collection: manifest.collection,
        category: manifest.category,
      });
    } catch {
      // Invalid chain manifests are not authorized members. A direct grant for
      // another healthy chain remains usable.
    }
  }

  const seen = new Set<string>();
  for (const resource of [...collections, ...chains]) {
    if (seen.has(resource.resourceId)) throw new ResourceResolutionError("duplicate-id");
    seen.add(resource.resourceId);
  }
  return { collections, chains };
}

export async function resolveResourceById(
  kind: "chain" | "collection",
  resourceId: string,
  options: ArchiveLocationOptions = {},
): Promise<ResolvedChainResource | ResolvedCollectionResource> {
  const index = await resolveArchiveResourceIndex(options);
  const resource = kind === "chain"
    ? index.chains.find((candidate) => candidate.resourceId === resourceId)
    : index.collections.find((candidate) => candidate.resourceId === resourceId);
  if (!resource) throw new ResourceResolutionError("not-found");
  return resource;
}

export function chainIsInCollection(
  chain: ResolvedChainResource,
  collection: ResolvedCollectionResource,
): boolean {
  return chain.collection === collection.slug && (!chain.category || collection.categories.has(chain.category));
}
