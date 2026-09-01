import "server-only";

import path from "node:path";

import { z } from "zod";

export const chainSlugSchema = z
  .string()
  .min(1)
  .max(120)
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Use lowercase letters, numbers, and single hyphens.");

export const resourceIdSchema = z.uuid();

function isSafeAttachmentPath(value: string): boolean {
  if (path.posix.isAbsolute(value) || path.win32.isAbsolute(value) || value.includes("\\")) {
    return false;
  }

  return value.split("/").every((rawSegment) => {
    let segment = rawSegment;
    for (let pass = 0; pass < 3; pass += 1) {
      try {
        segment = decodeURIComponent(segment);
      } catch {
        return false;
      }
      if (!segment.includes("%")) break;
    }

    return (
      rawSegment.length > 0 &&
      segment.length > 0 &&
      segment !== "." &&
      segment !== ".." &&
      !segment.includes("/") &&
      !segment.includes("\\") &&
      !segment.includes("\0") &&
      !path.posix.isAbsolute(segment) &&
      !path.win32.isAbsolute(segment)
    );
  });
}

export const relativeAttachmentPathSchema = z
  .string()
  .min(1)
  .max(1_024)
  .refine(isSafeAttachmentPath, "Use a safe path relative to the chain directory.");

export const chainManifestSchema = z
  .object({
    resourceId: resourceIdSchema.optional(),
    slug: chainSlugSchema,
    title: z.string().trim().min(1).max(240),
    description: z.string().trim().min(1).max(2_000).optional(),
    displayOrder: z.number().finite().optional(),
    collection: chainSlugSchema.optional(),
    category: chainSlugSchema.optional(),
  })
  .strict()
  .refine((manifest) => !manifest.category || manifest.collection, {
    message: "A category requires a collection.",
    path: ["category"],
  });

const organizationItemFields = {
  slug: chainSlugSchema,
  title: z.string().trim().min(1).max(240),
  description: z.string().trim().min(1).max(2_000).optional(),
  displayOrder: z.number().finite().optional(),
};

export const archiveCategorySchema = z.object(organizationItemFields).strict();

export const archiveCollectionSchema = z
  .object({
    resourceId: resourceIdSchema.optional(),
    ...organizationItemFields,
    categories: z.array(archiveCategorySchema).optional(),
  })
  .strict()
  .superRefine((collection, context) => {
    const seen = new Set<string>();
    collection.categories?.forEach((category, index) => {
      if (seen.has(category.slug)) {
        context.addIssue({
          code: "custom",
          message: `Duplicate category slug: ${category.slug}.`,
          path: ["categories", index, "slug"],
        });
      }
      seen.add(category.slug);
    });
  });

export const archiveManifestSchema = z
  .object({
    collections: z.array(archiveCollectionSchema),
  })
  .strict()
  .superRefine((manifest, context) => {
    const seen = new Set<string>();
    manifest.collections.forEach((collection, index) => {
      if (seen.has(collection.slug)) {
        context.addIssue({
          code: "custom",
          message: `Duplicate collection slug: ${collection.slug}.`,
          path: ["collections", index, "slug"],
        });
      }
      seen.add(collection.slug);
    });
  });

export const shareReadyChainManifestSchema = chainManifestSchema.refine(
  (manifest) => manifest.resourceId !== undefined,
  { message: "A stable resourceId is required for sharing.", path: ["resourceId"] },
);

export const shareReadyArchiveManifestSchema = archiveManifestSchema.superRefine(
  (manifest, context) => {
    const seen = new Set<string>();
    manifest.collections.forEach((collection, index) => {
      if (!collection.resourceId) {
        context.addIssue({
          code: "custom",
          message: "A stable resourceId is required for sharing.",
          path: ["collections", index, "resourceId"],
        });
      } else if (seen.has(collection.resourceId)) {
        context.addIssue({
          code: "custom",
          message: `Duplicate resourceId: ${collection.resourceId}.`,
          path: ["collections", index, "resourceId"],
        });
      } else {
        seen.add(collection.resourceId);
      }
    });
  },
);

export const attachmentSchema = z
  .object({
    title: z.string().trim().min(1).max(500),
    file: relativeAttachmentPathSchema,
    type: z
      .string()
      .trim()
      .min(3)
      .max(255)
      .regex(/^[!#$&^_.+\-\w]+\/[!#$&^_.+\-\w]+(?:\s*;.*)?$/i, "Use a valid MIME type."),
  })
  .strict();

export const emailFrontmatterSchema = z
  .object({
    id: z.string().trim().min(1).max(160),
    chain: chainSlugSchema,
    date: z.iso.datetime({ offset: true }),
    from: z.string().trim().min(1).max(500),
    to: z.array(z.string().trim().min(1).max(500)).min(1),
    cc: z.array(z.string().trim().min(1).max(500)).optional(),
    subject: z.string().trim().min(1).max(1_000),
    attachments: z.array(attachmentSchema).optional(),
  })
  .strict();
