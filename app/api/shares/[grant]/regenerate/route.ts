import { regenerateManagedShare, requireManagementMutation, shareManagementResponse } from "@/lib/server/shares/management";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request, context: { params: Promise<{ grant: string }> }) {
  try {
    await requireManagementMutation(request);
    await request.json();
    const result = regenerateManagedShare((await context.params).grant);
    return result ? shareManagementResponse({ active: true, grantId: result.grant.id, shareUrl: result.shareUrl }) : shareManagementResponse({ error: "Share not found." }, 404);
  } catch { return shareManagementResponse({ error: "Share could not be regenerated." }, 404); }
}
