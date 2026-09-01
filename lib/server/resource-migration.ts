import "server-only";

import { randomUUID } from "node:crypto";
import type { Dirent } from "node:fs";
import { lstat, readFile, readdir, rename, writeFile } from "node:fs/promises";
import path from "node:path";

import { parseDocument } from "yaml";

import { ARCHIVE_MANIFEST_FILENAME, CHAIN_MANIFEST_FILENAME } from "./archive-layout.ts";
import { getArchiveRoot, type ArchiveLocationOptions } from "./archive-root.ts";
import { archiveManifestSchema, chainManifestSchema, resourceIdSchema } from "./schemas.ts";

export type ResourceMigrationIssue = {
  file: string;
  kind: "missing" | "invalid" | "duplicate" | "archive";
  message: string;
};

export type ResourceMigrationResult = {
  changed: string[];
  issues: ResourceMigrationIssue[];
  missingCount: number;
  wrote: boolean;
};

type ParsedFile = {
  absolutePath: string;
  displayPath: string;
  document: ReturnType<typeof parseDocument>;
  ids: { current?: unknown; set(value: string): void }[];
};

async function atomicWrite(file: string, contents: string): Promise<void> {
  const temporary = `${file}.tmp-${process.pid}-${randomUUID()}`;
  await writeFile(temporary, contents, { encoding: "utf8", mode: 0o600 });
  await rename(temporary, file);
}

export async function migrateResourceIds(
  options: ArchiveLocationOptions & { write?: boolean } = {},
): Promise<ResourceMigrationResult> {
  const root = getArchiveRoot(options);
  const issues: ResourceMigrationIssue[] = [];
  const parsedFiles: ParsedFile[] = [];

  const archivePath = path.join(root, ARCHIVE_MANIFEST_FILENAME);
  try {
    if ((await lstat(archivePath)).isSymbolicLink()) throw new Error("symbolic links are not migrated");
    const document = parseDocument(await readFile(archivePath, "utf8"));
    if (document.errors.length) throw new Error(document.errors[0]?.message);
    const value = document.toJS() as { collections?: { resourceId?: unknown }[] };
    const validationValue = structuredClone(value);
    validationValue.collections?.forEach((collection) => {
      if (collection.resourceId !== undefined && !resourceIdSchema.safeParse(collection.resourceId).success) delete collection.resourceId;
    });
    const checked = archiveManifestSchema.safeParse(validationValue);
    if (!checked.success) throw new Error(checked.error.issues.map((issue) => issue.message).join("; "));
    const ids = checked.data.collections.map((collection, index) => ({
      current: value.collections?.[index]?.resourceId,
      set(id: string) {
        document.setIn(["collections", index, "resourceId"], id);
      },
    }));
    parsedFiles.push({ absolutePath: archivePath, displayPath: ARCHIVE_MANIFEST_FILENAME, document, ids });
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") {
      issues.push({ file: ARCHIVE_MANIFEST_FILENAME, kind: "archive", message: `Cannot safely migrate archive.yml: ${error instanceof Error ? error.message : "invalid file"}` });
    }
  }

  let entries: Dirent<string>[] = [];
  try {
    entries = await readdir(root, { withFileTypes: true });
  } catch (error) {
    issues.push({ file: root, kind: "archive", message: `Cannot read archive root: ${error instanceof Error ? error.message : "filesystem error"}` });
  }

  for (const entry of entries.filter((candidate) => (candidate.isDirectory() || candidate.isSymbolicLink()) && !candidate.name.startsWith(".")).sort((a, b) => a.name.localeCompare(b.name))) {
    const manifestPath = path.join(root, entry.name, CHAIN_MANIFEST_FILENAME);
    try {
      if (entry.isSymbolicLink() || (await lstat(manifestPath)).isSymbolicLink()) throw new Error("symbolic links are not migrated");
      const document = parseDocument(await readFile(manifestPath, "utf8"));
      if (document.errors.length) throw new Error(document.errors[0]?.message);
      const value = document.toJS() as Record<string, unknown>;
      const validationValue = { ...value };
      if (validationValue.resourceId !== undefined && !resourceIdSchema.safeParse(validationValue.resourceId).success) delete validationValue.resourceId;
      const checked = chainManifestSchema.safeParse(validationValue);
      if (!checked.success) throw new Error(checked.error.issues.map((issue) => issue.message).join("; "));
      if (checked.data.slug !== entry.name) throw new Error("slug does not match its directory");
      parsedFiles.push({
        absolutePath: manifestPath,
        displayPath: `${entry.name}/${CHAIN_MANIFEST_FILENAME}`,
        document,
        ids: [{ current: value.resourceId, set(id: string) { document.set("resourceId", id); } }],
      });
    } catch (error) {
      issues.push({ file: `${entry.name}/${CHAIN_MANIFEST_FILENAME}`, kind: "archive", message: `Cannot safely migrate chain manifest: ${error instanceof Error ? error.message : "invalid file"}` });
    }
  }

  const seen = new Map<string, string>();
  let missingCount = 0;
  for (const file of parsedFiles) {
    for (const id of file.ids) {
      if (id.current === undefined) {
        missingCount += 1;
        issues.push({ file: file.displayPath, kind: "missing", message: "Missing stable resourceId." });
        continue;
      }
      if (!resourceIdSchema.safeParse(id.current).success) {
        issues.push({ file: file.displayPath, kind: "invalid", message: `Invalid resourceId: ${String(id.current)}.` });
        continue;
      }
      const validId = id.current as string;
      const previous = seen.get(validId);
      if (previous) {
        issues.push({ file: file.displayPath, kind: "duplicate", message: `resourceId duplicates ${previous}.` });
      } else {
        seen.set(validId, file.displayPath);
      }
    }
  }

  const blocking = issues.some((issue) => issue.kind !== "missing");
  if (!options.write || blocking || missingCount === 0) {
    return { changed: [], issues, missingCount, wrote: false };
  }

  const generated = new Set(seen.keys());
  for (const file of parsedFiles) {
    for (const id of file.ids) {
      if (id.current !== undefined) continue;
      let value = randomUUID();
      while (generated.has(value)) value = randomUUID();
      generated.add(value);
      id.set(value);
    }
  }

  // All documents and generated IDs are validated before the first write. Each
  // individual replacement is atomic; callers should still keep archive backups.
  for (const file of parsedFiles.filter((candidate) => candidate.ids.some((id) => id.current === undefined))) {
    await atomicWrite(file.absolutePath, file.document.toString());
  }

  return {
    changed: parsedFiles.filter((candidate) => candidate.ids.some((id) => id.current === undefined)).map((file) => file.displayPath),
    issues: [],
    missingCount,
    wrote: true,
  };
}
