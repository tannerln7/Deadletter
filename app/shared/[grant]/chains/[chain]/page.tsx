import { notFound } from "next/navigation";

import EmailChainViewer, { normalizeChainSortOrder } from "@/components/EmailChainViewer";
import { loadChain } from "@/lib/server/chains";
import { isValidChainSlug } from "@/lib/server/request-path";
import { requireShareAccess } from "@/lib/server/shares/access";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function SharedChainPage({ params, searchParams }: { params: Promise<{ grant: string; chain: string }>; searchParams: Promise<{ sort?: string | string[] }> }) {
  const { grant, chain } = await params;
  if (!isValidChainSlug(chain)) notFound();
  try { await requireShareAccess({ grantId: grant, chainSlug: chain }); } catch { notFound(); }
  const loaded = await loadChain(chain);
  return <main className="page-shell max-w-[72rem] py-8 sm:py-12"><EmailChainViewer {...loaded} sortOrder={normalizeChainSortOrder((await searchParams).sort)} sharedGrantId={grant} /></main>;
}
