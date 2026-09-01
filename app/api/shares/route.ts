import { z } from "zod";

import { requireShareManager } from "@/lib/server/security/private-access";
import { findManagedGrant, grantIsActive } from "@/lib/server/shares/database";
import { createManagedShare, requireManagementMutation, shareManagementResponse } from "@/lib/server/shares/management";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const requestSchema = z.object({ resourceKind: z.enum(["chain", "collection"]), resourceId: z.uuid() }).strict();

export async function GET(request: Request) {
  try {
    await requireShareManager(request.headers);
    const url = new URL(request.url);
    const parsed = requestSchema.safeParse({ resourceKind: url.searchParams.get("resourceKind"), resourceId: url.searchParams.get("resourceId") });
    if (!parsed.success) return shareManagementResponse({ error: "Invalid resource." }, 400);
    const grant = findManagedGrant(parsed.data.resourceKind, parsed.data.resourceId);
    return shareManagementResponse({ active: Boolean(grant && grantIsActive(grant)), grantId: grant && grantIsActive(grant) ? grant.id : null });
  } catch { return shareManagementResponse({ error: "Not found." }, 404); }
}

export async function POST(request: Request) {
  try {
    const identity = await requireManagementMutation(request);
    const parsed = requestSchema.safeParse(await request.json());
    if (!parsed.success) return shareManagementResponse({ error: "Invalid resource." }, 400);
    const result = await createManagedShare({ kind: parsed.data.resourceKind, resourceId: parsed.data.resourceId, createdBySub: identity.sub });
    if (result.conflict) return shareManagementResponse({ error: "This resource already has an active share.", grantId: result.grant.id }, 409);
    return shareManagementResponse({ active: true, grantId: result.grant.id, shareUrl: result.shareUrl }, 201);
  } catch { return shareManagementResponse({ error: "Share could not be created." }, 404); }
}
