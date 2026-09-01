import { requireManagementMutation, revokeManagedShare, shareManagementResponse } from "@/lib/server/shares/management";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request, context: { params: Promise<{ grant: string }> }) {
  try {
    await requireManagementMutation(request);
    await request.json();
    return revokeManagedShare((await context.params).grant) ? shareManagementResponse({ active: false }) : shareManagementResponse({ error: "Share not found." }, 404);
  } catch { return shareManagementResponse({ error: "Share could not be revoked." }, 404); }
}
