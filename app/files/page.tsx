import Link from "next/link";

import ArchiveDiagnostics from "@/components/ArchiveDiagnostics";
import ErrorState from "@/components/ErrorState";
import FileBrowser from "@/components/FileBrowser";
import { ArchiveError } from "@/lib/server/errors";
import { enumerateArchiveFiles } from "@/lib/server/files";
import { requirePrivateAccess } from "@/lib/server/security/private-access";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

async function getFileData() {
  try {
    return { data: await enumerateArchiveFiles(), error: null } as const;
  } catch (error) {
    return { data: null, error } as const;
  }
}

export default async function FilesPage() {
  await requirePrivateAccess();
  const result = await getFileData();

  if (result.data) {
    const { files, errors } = result.data;
    return (
      <main className="page-shell py-8 sm:py-12">
        <header className="border-b border-[var(--line)] pb-7 sm:pb-9">
          <Link href="/" className="text-link inline-flex min-h-11 items-center text-sm font-semibold">
            ← All chains
          </Link>
          <p className="eyebrow mt-3">Across the archive</p>
          <h1 className="mt-2 text-3xl font-semibold tracking-[-0.04em] text-[var(--ink)] sm:text-4xl">
            Files
          </h1>
          <p className="mt-3 max-w-2xl text-base leading-7 text-[var(--muted)]">
            A focused view of attachments referenced by archive entries. Preview originals safely or filter by chain and file type.
          </p>
        </header>

        <div className="py-6">
          <ArchiveDiagnostics diagnostics={errors} />
        </div>
        <FileBrowser files={files} />
      </main>
    );
  }

  const missingArchive = result.error instanceof ArchiveError && result.error.code === "archive-not-found";
  console.error("Archive files could not be loaded", result.error);

  return (
    <main className="page-shell py-12 sm:py-16">
      <ErrorState
        title={missingArchive ? "Archive directory not found" : "Files unavailable"}
        description={
          missingArchive
            ? "Create data/chains, or set ARCHIVE_DATA_DIR to an existing archive directory."
            : "The file index could not be read. Check the server logs and filesystem permissions."
        }
      />
    </main>
  );
}
