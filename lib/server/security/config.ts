import "server-only";

import { z } from "zod";

const originSchema = z.url().refine((value) => {
  const url = new URL(value);
  return url.protocol === "https:" && url.pathname === "/" && !url.search && !url.hash;
}, "Use a canonical HTTPS origin with no path, query, or fragment.");

export type SecurityConfig = {
  privateOrigin: URL;
  shareOrigin: URL;
};

export function loadSecurityConfig(environment: Record<string, string | undefined> = process.env): SecurityConfig {
  const privateOrigin = originSchema.safeParse(environment.ARCHIVE_PRIVATE_ORIGIN);
  const shareOrigin = originSchema.safeParse(environment.ARCHIVE_SHARE_ORIGIN);
  if (!privateOrigin.success || !shareOrigin.success) {
    throw new Error("Canonical archive origins are not configured.");
  }
  const privateUrl = new URL(privateOrigin.data);
  const shareUrl = new URL(shareOrigin.data);
  if (privateUrl.host === shareUrl.host) throw new Error("Private and share origins must use different hosts.");
  return { privateOrigin: privateUrl, shareOrigin: shareUrl };
}

export function requestHost(headers: Headers): string {
  const value = headers.get("host")?.trim().toLowerCase();
  if (!value || value.includes(",") || /[\s/@\\]/.test(value)) return "";
  try {
    return new URL(`https://${value}`).host;
  } catch {
    return "";
  }
}

export function requireExpectedHost(headers: Headers, expected: URL): void {
  if (requestHost(headers) !== expected.host.toLowerCase()) throw new Error("Request host is not allowed.");
}
