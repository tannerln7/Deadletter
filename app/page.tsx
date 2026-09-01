import ArchiveDiagnostics from "@/components/ArchiveDiagnostics";
import ChainCard from "@/components/ChainCard";
import EmptyState from "@/components/EmptyState";
import ErrorState from "@/components/ErrorState";
import OrganizationCard from "@/components/OrganizationCard";
import { ArchiveError } from "@/lib/server/errors";
import { discoverArchiveHierarchy } from "@/lib/server/organization";
import { requirePrivateAccess } from "@/lib/server/security/private-access";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

async function getHomepageData() {
  try {
    return { data: await discoverArchiveHierarchy(), error: null } as const;
  } catch (error) {
    return { data: null, error } as const;
  }
}

export default async function Home() {
  await requirePrivateAccess();
  const result = await getHomepageData();

  if (result.data) {
    const { collections, ungrouped, errors } = result.data;
    const chainCount =
      ungrouped.length +
      collections.reduce(
        (total, collection) =>
          total + collection.chains.length + collection.categories.reduce((sum, category) => sum + category.chains.length, 0),
        0,
      );
    return (
      <main className="page-shell py-10 sm:py-14">
        <header className="border-b border-[var(--line)] pb-8 sm:pb-10">
          <p className="eyebrow">Deadletter</p>
          <h1 className="mt-3 max-w-4xl text-4xl font-semibold tracking-[-0.045em] text-[var(--ink)] sm:text-5xl">
            Correspondence, reconstructed.
          </h1>
          <p className="mt-4 max-w-2xl text-base leading-7 text-[var(--muted)] sm:text-lg sm:leading-8">
            Turn scattered email threads and attachments into structured, browsable, shareable archives without moving private files into a database or public directory.
          </p>
        </header>

        <div className="py-6">
          <ArchiveDiagnostics diagnostics={errors} />
        </div>

        {collections.length > 0 ? (
          <section aria-labelledby="collections-heading">
            <div className="flex items-baseline justify-between gap-4 border-b border-[var(--line-strong)] pb-3">
              <h2 id="collections-heading" className="text-sm font-semibold uppercase tracking-[0.1em] text-[var(--ink)]">
                Collections
              </h2>
              <span className="text-sm text-[var(--muted)]">
                {collections.length} {collections.length === 1 ? "collection" : "collections"}
              </span>
            </div>
            <div>
              {collections.map((collection) => {
                const collectionChainCount =
                  collection.chains.length +
                  collection.categories.reduce((sum, category) => sum + category.chains.length, 0);
                return (
                  <OrganizationCard
                    key={collection.slug}
                    href={`/collections/${encodeURIComponent(collection.slug)}`}
                    title={collection.title}
                    description={collection.description}
                    chainCount={collectionChainCount}
                    categoryCount={collection.categories.length}
                    actionLabel="Open collection"
                  />
                );
              })}
            </div>
          </section>
        ) : null}

        <section aria-labelledby="chains-heading" className={collections.length > 0 ? "mt-10" : undefined}>
          <div className="flex items-baseline justify-between gap-4 border-b border-[var(--line-strong)] pb-3">
            <h2 id="chains-heading" className="text-sm font-semibold uppercase tracking-[0.1em] text-[var(--ink)]">
              {collections.length > 0 ? "Ungrouped chains" : "Chains"}
            </h2>
            <span className="text-sm text-[var(--muted)]">
              {ungrouped.length} {ungrouped.length === 1 ? "chain" : "chains"}
            </span>
          </div>

          {ungrouped.length > 0 ? (
            <div>
              {ungrouped.map((chain) => (
                <ChainCard key={chain.slug} chain={chain} />
              ))}
            </div>
          ) : chainCount === 0 ? (
            <EmptyState
              title="No chains found"
              description="Create a chain directory containing chain.yml and an emails/ directory under data/chains, then refresh this page."
              actionHref="/files"
              actionLabel="Open file browser"
            />
          ) : (
            <p className="py-8 text-sm text-[var(--muted)]">Every valid chain belongs to a collection.</p>
          )}
        </section>
      </main>
    );
  }

  const missingArchive = result.error instanceof ArchiveError && result.error.code === "archive-not-found";
  console.error("Archive homepage could not be loaded", result.error);

  return (
    <main className="page-shell py-12 sm:py-16">
      <h1 className="text-3xl font-semibold tracking-[-0.04em] text-[var(--ink)]">Deadletter</h1>
      <div className="mt-8">
        <ErrorState
          title={missingArchive ? "Archive directory not found" : "Archive unavailable"}
          description={
            missingArchive
              ? "Create data/chains, or set ARCHIVE_DATA_DIR to an existing archive directory, then refresh this page."
              : "The archive could not be read. Check the server logs and filesystem permissions."
          }
          backHref="/"
          backLabel="Try again"
        />
      </div>
    </main>
  );
}
