import { notFound } from "next/navigation";

import ArchiveBreadcrumbs from "@/components/ArchiveBreadcrumbs";
import ArchiveDiagnostics from "@/components/ArchiveDiagnostics";
import ChainCard from "@/components/ChainCard";
import EmptyState from "@/components/EmptyState";
import ErrorState from "@/components/ErrorState";
import { discoverArchiveHierarchy } from "@/lib/server/organization";
import { isValidChainSlug } from "@/lib/server/request-path";
import { requirePrivateAccess } from "@/lib/server/security/private-access";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

type CategoryPageProps = {
  params: Promise<{ collection: string; category: string }>;
};

export default async function CategoryPage({ params }: CategoryPageProps) {
  await requirePrivateAccess();
  const { collection: collectionSlug, category: categorySlug } = await params;
  if (!isValidChainSlug(collectionSlug) || !isValidChainSlug(categorySlug)) notFound();

  let hierarchy;
  try {
    hierarchy = await discoverArchiveHierarchy();
  } catch (error) {
    console.error(`Archive category ${collectionSlug}/${categorySlug} could not be loaded`, error);
    return (
      <main className="page-shell py-12 sm:py-16">
        <ErrorState
          title="This category could not be displayed"
          description="The archive could not be read. Check the server logs and filesystem permissions."
        />
      </main>
    );
  }

  const collection = hierarchy.collections.find((candidate) => candidate.slug === collectionSlug);
  const category = collection?.categories.find((candidate) => candidate.slug === categorySlug);
  if (!collection || !category) notFound();

  return (
    <main className="page-shell py-8 sm:py-12">
      <ArchiveBreadcrumbs
        items={[
          { href: "/", label: "Archive" },
          { href: `/collections/${encodeURIComponent(collection.slug)}`, label: collection.title },
          { label: category.title },
        ]}
      />
      <header className="border-b border-[var(--line)] pb-7 sm:pb-9">
        <p className="eyebrow">Category</p>
        <h1 className="mt-3 text-3xl font-semibold tracking-[-0.04em] text-[var(--ink)] sm:text-4xl">
          {category.title}
        </h1>
        {category.description ? (
          <p className="mt-3 max-w-3xl text-base leading-7 text-[var(--muted)]">{category.description}</p>
        ) : null}
      </header>

      <div className="py-6">
        <ArchiveDiagnostics diagnostics={hierarchy.errors} />
      </div>

      <section aria-labelledby="category-chains-heading">
        <div className="flex items-baseline justify-between gap-4 border-b border-[var(--line-strong)] pb-3">
          <h2 id="category-chains-heading" className="text-sm font-semibold uppercase tracking-[0.1em] text-[var(--ink)]">
            Chains
          </h2>
          <span className="text-sm text-[var(--muted)]">{category.chains.length}</span>
        </div>
        {category.chains.length > 0 ? (
          <div>{category.chains.map((chain) => <ChainCard key={chain.slug} chain={chain} />)}</div>
        ) : (
          <EmptyState
            title="No chains in this category"
            description="Assign a valid chain to this collection and category, then refresh this page."
          />
        )}
      </section>
    </main>
  );
}
