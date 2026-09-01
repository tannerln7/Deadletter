import "server-only";

import { cookies as nextCookies, headers as nextHeaders } from "next/headers";

import { loadSecurityConfig, requireExpectedHost } from "../security/config";
import {
  credentialMatches,
  findGrantById,
  grantIsActive,
  ShareDatabaseUnavailableError,
  type ShareGrant,
} from "./database";
import {
  chainIsInCollection,
  resolveArchiveResourceIndex,
  type ResolvedChainResource,
  type ResolvedCollectionResource,
} from "../resources";

export class ShareAccessError extends Error {
  constructor() {
    super("Shared archive access denied.");
    this.name = "ShareAccessError";
  }
}

export function shareCookieName(grantId: string): string {
  return `__Secure-share_${grantId}`;
}

export type ShareAccessContext = {
  grant: ShareGrant;
  resource: ResolvedChainResource | ResolvedCollectionResource;
  authorizedChains: ResolvedChainResource[];
};

function cookieFromHeaders(headers: Headers, name: string): string | undefined {
  const cookie = headers.get("cookie");
  if (!cookie) return undefined;
  for (const pair of cookie.split(";")) {
    const separator = pair.indexOf("=");
    if (separator < 0 || pair.slice(0, separator).trim() !== name) continue;
    return pair.slice(separator + 1).trim();
  }
  return undefined;
}

export async function requireShareAccess(input: {
  grantId: string;
  chainSlug?: string;
  headers?: Headers;
  cookieValue?: string;
}): Promise<ShareAccessContext> {
  try {
    const requestHeaders = input.headers ?? new Headers(await nextHeaders());
    requireExpectedHost(requestHeaders, loadSecurityConfig().shareOrigin);
    const grant = findGrantById(input.grantId);
    if (!grant || !grantIsActive(grant)) throw new ShareAccessError();
    const cookieName = shareCookieName(grant.id);
    const cookieValue = input.cookieValue ?? (input.headers ? cookieFromHeaders(requestHeaders, cookieName) : (await nextCookies()).get(cookieName)?.value);
    if (!cookieValue || !credentialMatches(grant, cookieValue)) throw new ShareAccessError();

    const index = await resolveArchiveResourceIndex();
    const resource = grant.resourceKind === "chain"
      ? index.chains.find((candidate) => candidate.resourceId === grant.resourceId)
      : index.collections.find((candidate) => candidate.resourceId === grant.resourceId);
    if (!resource) throw new ShareAccessError();

    const authorizedChains = resource.kind === "chain"
      ? [resource]
      : index.chains.filter((chain) => chainIsInCollection(chain, resource));
    if (input.chainSlug && !authorizedChains.some((chain) => chain.slug === input.chainSlug)) {
      throw new ShareAccessError();
    }
    return { grant, resource, authorizedChains };
  } catch (error) {
    if (error instanceof ShareAccessError) throw error;
    if (error instanceof ShareDatabaseUnavailableError) throw new ShareAccessError();
    throw new ShareAccessError();
  }
}

export const sharedFileResponseHeaders = {
  "Cache-Control": "private, no-store, max-age=0, must-revalidate",
  "Referrer-Policy": "no-referrer",
  "X-Content-Type-Options": "nosniff",
  "X-Robots-Tag": "noindex, nofollow, noarchive",
} as const;

export const sharedPageResponseHeaders = {
  ...sharedFileResponseHeaders,
  "Content-Security-Policy": "frame-ancestors 'none'; base-uri 'none'; form-action 'self'",
} as const;
