import { notFound } from "next/navigation";

import ArchiveBreadcrumbs from "@/components/ArchiveBreadcrumbs";
import EmailChainViewer, {
  normalizeChainSortOrder,
} from "@/components/EmailChainViewer";
import ErrorState from "@/components/ErrorState";
import ShareControls from "@/components/ShareControls";
import { loadChain } from "@/lib/server/chains";
import { ArchiveError } from "@/lib/server/errors";
import { loadArchiveOrganization } from "@/lib/server/organization";
import { isValidChainSlug } from "@/lib/server/request-path";
import { parseManagerSubjects, requirePrivateAccess } from "@/lib/server/security/private-access";
import { findManagedGrant, grantIsActive } from "@/lib/server/shares/database";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

type ChainPageProps = {
  params: Promise<{ chain: string }>;
  searchParams: Promise<{ sort?: string | string[] }>;
};

async function getChainData(chain: string) {
  try {
    const data = await loadChain(chain);
    const organization = await loadArchiveOrganization();
    return { data, organization, error: null } as const;
  } catch (error) {
    return { data: null, organization: null, error } as const;
  }
}

export default async function ChainPage({ params, searchParams }: ChainPageProps) {
  const identity = await requirePrivateAccess();
  const { chain } = await params;
  const sortOrder = normalizeChainSortOrder((await searchParams).sort);

  if (!isValidChainSlug(chain)) notFound();

  const result = await getChainData(chain);
  if (result.data) {
    const referencedCollection = result.organization?.manifest?.collections.find(
      (candidate) => candidate.slug === result.data.manifest.collection,
    );
    const category = referencedCollection?.categories?.find(
      (candidate) => candidate.slug === result.data.manifest.category,
    );
    const collection =
      referencedCollection && (!result.data.manifest.category || category)
        ? referencedCollection
        : undefined;
    const breadcrumbs = [
      { href: "/", label: "Archive" },
      ...(collection
        ? [
            {
              href: `/collections/${encodeURIComponent(collection.slug)}`,
              label: collection.title,
            },
          ]
        : []),
      ...(collection && category
        ? [
            {
              href: `/collections/${encodeURIComponent(collection.slug)}/${encodeURIComponent(category.slug)}`,
              label: category.title,
            },
          ]
        : []),
      { label: result.data.manifest.title },
    ];
    let managedGrant;
    if (result.data.manifest.resourceId && parseManagerSubjects().has(identity.sub)) {
      try { managedGrant = findManagedGrant("chain", result.data.manifest.resourceId); } catch {}
    }
    return (
      <main className="page-shell max-w-[72rem] py-8 sm:py-12">
        <ArchiveBreadcrumbs items={breadcrumbs} />
        {result.data.manifest.resourceId && parseManagerSubjects().has(identity.sub) ? <ShareControls resourceKind="chain" resourceId={result.data.manifest.resourceId} initialActive={Boolean(managedGrant && grantIsActive(managedGrant))} initialGrantId={managedGrant && grantIsActive(managedGrant) ? managedGrant.id : undefined} /> : null}
        <EmailChainViewer {...result.data} sortOrder={sortOrder} />
      </main>
    );
  }

  if (result.error instanceof ArchiveError && result.error.code === "unknown-chain") notFound();
  console.error(`Archive chain ${chain} could not be loaded`, result.error);

  return (
    <main className="page-shell py-12 sm:py-16">
      <ErrorState
        title="This chain could not be displayed"
        description={
          result.error instanceof ArchiveError
            ? result.error.message
            : "The chain could not be read. Check the server logs and filesystem permissions."
        }
      />
    </main>
  );
}
