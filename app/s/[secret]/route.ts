import { NextResponse } from "next/server";

import { loadSecurityConfig, requireExpectedHost } from "@/lib/server/security/config";
import { findGrantBySecret, grantIsActive, isValidShareSecret } from "@/lib/server/shares/database";
import { shareCookieName, sharedPageResponseHeaders } from "@/lib/server/shares/access";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request, context: { params: Promise<{ secret: string }> }) {
  try {
    requireExpectedHost(request.headers, loadSecurityConfig().shareOrigin);
    const { secret } = await context.params;
    if (!isValidShareSecret(secret)) throw new Error("invalid");
    const grant = findGrantBySecret(secret);
    if (!grant || !grantIsActive(grant)) throw new Error("invalid");
    const destination = new URL(`/shared/${encodeURIComponent(grant.id)}`, loadSecurityConfig().shareOrigin);
    const response = NextResponse.redirect(destination, 303);
    Object.entries(sharedPageResponseHeaders).forEach(([name, value]) => response.headers.set(name, value));
    const now = Math.floor(Date.now() / 1000);
    const maxAge = grant.expiresAt === null ? 43_200 : Math.max(1, Math.min(43_200, grant.expiresAt - now));
    response.cookies.set(shareCookieName(grant.id), secret, {
      httpOnly: true,
      maxAge,
      path: `/shared/${grant.id}`,
      sameSite: "lax",
      secure: true,
    });
    return response;
  } catch {
    return new Response("Shared item not found.", { status: 404, headers: sharedPageResponseHeaders });
  }
}
