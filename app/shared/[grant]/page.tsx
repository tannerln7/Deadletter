import type { Metadata } from "next";
import { notFound } from "next/navigation";

import ArchiveDiagnostics from "@/components/ArchiveDiagnostics";
import ChainCard from "@/components/ChainCard";
import EmailChainViewer, { normalizeChainSortOrder } from "@/components/EmailChainViewer";
import EmptyState from "@/components/EmptyState";
import OrganizationCard from "@/components/OrganizationCard";
import { loadChain } from "@/lib/server/chains";
import { requireShareAccess } from "@/lib/server/shares/access";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;
export const metadata: Metadata = { robots: { index: false, follow: false } };

export default async function SharedRootPage({ params, searchParams }: { params: Promise<{ grant: string }>; searchParams: Promise<{ sort?: string | string[] }> }) {
  const { grant } = await params;
  let access;
  try { access = await requireShareAccess({ grantId: grant }); } catch { notFound(); }
  if (access.resource.kind === "chain") {
    const chain = await loadChain(access.resource.slug);
    return <main className="page-shell max-w-[72rem] py-8 sm:py-12"><EmailChainViewer {...chain} sortOrder={normalizeChainSortOrder((await searchParams).sort)} sharedGrantId={grant} /></main>;
  }

  const loaded = await Promise.allSettled(access.authorizedChains.map((chain) => loadChain(chain.slug)));
  const chains = loaded.flatMap((result) => result.status === "fulfilled" ? [result.value.summary] : []);
  const diagnostics = loaded.flatMap((result, index) => result.status === "rejected" ? [{ code: "filesystem-error" as const, chainSlug: access.authorizedChains[index]?.slug, message: "A shared chain could not be loaded." }] : []);
  const categories = [...access.resource.categories].sort();
  return (
    <main className="page-shell py-8 sm:py-12">
      <header className="border-b border-[var(--line)] pb-7 sm:pb-9"><p className="eyebrow">Shared collection</p><h1 className="mt-3 text-3xl font-semibold text-[var(--ink)]">{access.resource.title}</h1></header>
      <div className="py-6"><ArchiveDiagnostics diagnostics={diagnostics} /></div>
      {categories.length ? <section><h2 className="border-b border-[var(--line-strong)] pb-3 text-sm font-semibold uppercase tracking-[0.1em]">Categories</h2>{categories.map((category) => <OrganizationCard key={category} href={`/shared/${grant}/categories/${encodeURIComponent(category)}`} title={access.resource.kind === "collection" ? access.resource.categoryTitles.get(category) ?? category : category} chainCount={chains.filter((chain) => chain.category === category).length} actionLabel="Open category" nativeNavigation />)}</section> : null}
      <section className={categories.length ? "mt-10" : undefined}><h2 className="border-b border-[var(--line-strong)] pb-3 text-sm font-semibold uppercase tracking-[0.1em]">Chains</h2>{chains.filter((chain) => !chain.category).map((chain) => <ChainCard key={chain.slug} chain={chain} href={`/shared/${grant}/chains/${encodeURIComponent(chain.slug)}`} nativeNavigation />)}{chains.length === 0 ? <EmptyState title="No shared chains available" description="This collection currently has no available chains." /> : null}</section>
    </main>
  );
}
