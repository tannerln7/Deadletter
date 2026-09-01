import { notFound } from "next/navigation";

import ChainCard from "@/components/ChainCard";
import EmptyState from "@/components/EmptyState";
import { loadChain } from "@/lib/server/chains";
import { isValidChainSlug } from "@/lib/server/request-path";
import { requireShareAccess } from "@/lib/server/shares/access";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function SharedCategoryPage({ params }: { params: Promise<{ grant: string; category: string }> }) {
  const { grant, category } = await params;
  if (!isValidChainSlug(category)) notFound();
  let access;
  try { access = await requireShareAccess({ grantId: grant }); } catch { notFound(); }
  if (access.resource.kind !== "collection" || !access.resource.categories.has(category)) notFound();
  const members = access.authorizedChains.filter((chain) => chain.category === category);
  const loaded = (await Promise.allSettled(members.map((chain) => loadChain(chain.slug)))).flatMap((result) => result.status === "fulfilled" ? [result.value.summary] : []);
  return <main className="page-shell py-8 sm:py-12"><a href={`/shared/${grant}`} className="text-link inline-flex min-h-11 items-center text-sm font-semibold">← Shared collection</a><h1 className="mt-3 border-b border-[var(--line)] pb-7 text-3xl font-semibold text-[var(--ink)]">{access.resource.categoryTitles.get(category) ?? category}</h1>{loaded.length ? loaded.map((chain) => <ChainCard key={chain.slug} chain={chain} href={`/shared/${grant}/chains/${encodeURIComponent(chain.slug)}`} nativeNavigation />) : <EmptyState title="No shared chains available" description="This category currently has no available chains." />}</main>;
}
