import "server-only";

import { loadSecurityConfig, requireExpectedHost } from "../security/config";
import { requireShareManager } from "../security/private-access";
import { resolveResourceById } from "../resources";
import {
  createGrant,
  findGrantById,
  findManagedGrant,
  grantIsActive,
  regenerateGrant,
  revokeGrant,
  type ShareResourceKind,
} from "./database";

export const SHARE_MANAGEMENT_HEADER = "x-archive-request";
export const SHARE_MANAGEMENT_HEADER_VALUE = "share-management";

export function shareManagementResponse(body: unknown, status = 200): Response {
  return Response.json(body, { status, headers: { "Cache-Control": "private, no-store, max-age=0", "X-Content-Type-Options": "nosniff" } });
}

export async function requireManagementMutation(request: Request) {
  const config = loadSecurityConfig();
  requireExpectedHost(request.headers, config.privateOrigin);
  if (request.headers.get("origin") !== config.privateOrigin.origin) throw new Error("invalid origin");
  if (request.headers.get("content-type")?.split(";", 1)[0].trim().toLowerCase() !== "application/json") throw new Error("invalid content type");
  if (request.headers.get(SHARE_MANAGEMENT_HEADER) !== SHARE_MANAGEMENT_HEADER_VALUE) throw new Error("invalid request header");
  const fetchSite = request.headers.get("sec-fetch-site");
  if (fetchSite && fetchSite !== "same-origin" && fetchSite !== "none") throw new Error("cross-site request");
  return requireShareManager(request.headers);
}

export async function createManagedShare(input: { kind: ShareResourceKind; resourceId: string; createdBySub: string }) {
  await resolveResourceById(input.kind, input.resourceId);
  const existing = findManagedGrant(input.kind, input.resourceId);
  if (existing && grantIsActive(existing)) return { conflict: true as const, grant: existing };
  if (existing) revokeGrant(existing.id);
  const created = createGrant({ resourceKind: input.kind, resourceId: input.resourceId, createdBySub: input.createdBySub });
  const shareUrl = new URL(`/s/${created.secret}`, loadSecurityConfig().shareOrigin).toString();
  return { conflict: false as const, grant: created.grant, shareUrl };
}

export function regenerateManagedShare(grantId: string) {
  const current = findGrantById(grantId);
  if (!current || !grantIsActive(current)) return undefined;
  const regenerated = regenerateGrant(grantId);
  if (!regenerated) return undefined;
  return { grant: regenerated.grant, shareUrl: new URL(`/s/${regenerated.secret}`, loadSecurityConfig().shareOrigin).toString() };
}

export function revokeManagedShare(grantId: string): boolean { return revokeGrant(grantId); }
