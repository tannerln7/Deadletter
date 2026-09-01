import { NextRequest, NextResponse } from "next/server";

function configuredHost(value: string | undefined): string | undefined {
  try { return value ? new URL(value).host.toLowerCase() : undefined; } catch { return undefined; }
}

function denied(): NextResponse {
  return new NextResponse("Not found", { status: 404, headers: { "Cache-Control": "private, no-store" } });
}

export function classifyArchiveRequest(
  host: string,
  pathname: string,
  environment: Record<string, string | undefined> = process.env,
): "private" | "share" | "static" | "deny" {
  const privateHost = configuredHost(environment.ARCHIVE_PRIVATE_ORIGIN);
  const shareHost = configuredHost(environment.ARCHIVE_SHARE_ORIGIN);
  const normalizedHost = host.toLowerCase();
  const frameworkStatic = pathname.startsWith("/_next/static/") || pathname === "/favicon.ico" || pathname === "/robots.txt";
  if (!privateHost || !shareHost || !normalizedHost) return "deny";
  if (frameworkStatic && (normalizedHost === privateHost || normalizedHost === shareHost)) return "static";
  if (normalizedHost === shareHost) {
    if (pathname === "/_next/image" || pathname.startsWith("/_next/image/")) return "deny";
    return pathname.startsWith("/s/") || pathname.startsWith("/shared/") ? "share" : "deny";
  }
  if (normalizedHost === privateHost) {
    if (pathname.startsWith("/s/") || pathname.startsWith("/shared/")) return "deny";
    return "private";
  }
  return "deny";
}

export function proxy(request: NextRequest) {
  // Host is deliberately taken from the origin Host field, not X-Forwarded-Host.
  const classification = classifyArchiveRequest(request.headers.get("host") ?? "", request.nextUrl.pathname);
  if (classification === "deny") return denied();
  if (classification === "private" && !request.headers.get("cf-access-jwt-assertion")) return denied();
  return NextResponse.next();
}

export const config = { matcher: "/:path*" };
