import { notFound } from "next/navigation";

import ArchiveBreadcrumbs from "@/components/ArchiveBreadcrumbs";
import ArchiveDiagnostics from "@/components/ArchiveDiagnostics";
import ChainCard from "@/components/ChainCard";
import EmptyState from "@/components/EmptyState";
import ErrorState from "@/components/ErrorState";
import OrganizationCard from "@/components/OrganizationCard";
import ShareControls from "@/components/ShareControls";
import { isValidChainSlug } from "@/lib/server/request-path";
import { discoverArchiveHierarchy } from "@/lib/server/organization";
import { parseManagerSubjects, requirePrivateAccess } from "@/lib/server/security/private-access";
import { findManagedGrant, grantIsActive } from "@/lib/server/shares/database";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

type CollectionPageProps = {
  params: Promise<{ collection: string }>;
};

export default async function CollectionPage({ params }: CollectionPageProps) {
  const identity = await requirePrivateAccess();
  const { collection: collectionSlug } = await params;
  if (!isValidChainSlug(collectionSlug)) notFound();

  let hierarchy;
  try {
    hierarchy = await discoverArchiveHierarchy();
  } catch (error) {
    console.error(`Archive collection ${collectionSlug} could not be loaded`, error);
    return (
      <main className="page-shell py-12 sm:py-16">
        <ErrorState
          title="This collection could not be displayed"
          description="The archive could not be read. Check the server logs and filesystem permissions."
        />
      </main>
    );
  }

  const collection = hierarchy.collections.find((candidate) => candidate.slug === collectionSlug);
  if (!collection) notFound();
  let managedGrant;
  if (collection.resourceId && parseManagerSubjects().has(identity.sub)) {
    try { managedGrant = findManagedGrant("collection", collection.resourceId); } catch {}
  }

  return (
    <main className="page-shell py-8 sm:py-12">
      <ArchiveBreadcrumbs items={[{ href: "/", label: "Archive" }, { label: collection.title }]} />
      <header className="border-b border-[var(--line)] pb-7 sm:pb-9">
        <p className="eyebrow">Collection</p>
        <h1 className="mt-3 text-3xl font-semibold tracking-[-0.04em] text-[var(--ink)] sm:text-4xl">
          {collection.title}
        </h1>
        {collection.description ? (
          <p className="mt-3 max-w-3xl text-base leading-7 text-[var(--muted)]">{collection.description}</p>
        ) : null}
        {collection.resourceId && parseManagerSubjects().has(identity.sub) ? <ShareControls resourceKind="collection" resourceId={collection.resourceId} initialActive={Boolean(managedGrant && grantIsActive(managedGrant))} initialGrantId={managedGrant && grantIsActive(managedGrant) ? managedGrant.id : undefined} /> : null}
      </header>

      <div className="py-6">
        <ArchiveDiagnostics diagnostics={hierarchy.errors} />
      </div>

      {collection.categories.length > 0 ? (
        <section aria-labelledby="categories-heading">
          <div className="flex items-baseline justify-between gap-4 border-b border-[var(--line-strong)] pb-3">
            <h2 id="categories-heading" className="text-sm font-semibold uppercase tracking-[0.1em] text-[var(--ink)]">
              Categories
            </h2>
            <span className="text-sm text-[var(--muted)]">{collection.categories.length}</span>
          </div>
          <div>
            {collection.categories.map((category) => (
              <OrganizationCard
                key={category.slug}
                href={`/collections/${encodeURIComponent(collection.slug)}/${encodeURIComponent(category.slug)}`}
                title={category.title}
                description={category.description}
                chainCount={category.chains.length}
                actionLabel="Open category"
              />
            ))}
          </div>
        </section>
      ) : null}

      <section aria-labelledby="collection-chains-heading" className={collection.categories.length > 0 ? "mt-10" : undefined}>
        <div className="flex items-baseline justify-between gap-4 border-b border-[var(--line-strong)] pb-3">
          <h2 id="collection-chains-heading" className="text-sm font-semibold uppercase tracking-[0.1em] text-[var(--ink)]">
            {collection.categories.length > 0 ? "Uncategorized chains" : "Chains"}
          </h2>
          <span className="text-sm text-[var(--muted)]">{collection.chains.length}</span>
        </div>
        {collection.chains.length > 0 ? (
          <div>{collection.chains.map((chain) => <ChainCard key={chain.slug} chain={chain} />)}</div>
        ) : (
          <EmptyState
            title={collection.categories.length > 0 ? "No uncategorized chains" : "No chains in this collection"}
            description={collection.categories.length > 0 ? "Open a category to browse its chains." : "Assign a valid chain to this collection, then refresh this page."}
          />
        )}
      </section>
    </main>
  );
}
