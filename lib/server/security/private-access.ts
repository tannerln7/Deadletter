import "server-only";

import { createRemoteJWKSet, jwtVerify, type JWTPayload, type JWTVerifyGetKey } from "jose";
import { headers as nextHeaders } from "next/headers";
import { z } from "zod";

import { loadSecurityConfig, requireExpectedHost } from "./config";

const accessConfigSchema = z.object({
  teamDomain: z.string().trim().min(1),
  audience: z.string().trim().min(1),
});

export type PrivateIdentity = { sub: string; email?: string };

export class PrivateAccessError extends Error {
  constructor() {
    super("Private archive access denied.");
    this.name = "PrivateAccessError";
  }
}

export type VerificationConfig = { issuer: string; audience: string; key: JWTVerifyGetKey };

export async function verifyAccessAssertion(
  assertion: string,
  config: VerificationConfig,
): Promise<PrivateIdentity> {
  try {
    const { payload } = await jwtVerify(assertion, config.key, {
      algorithms: ["RS256"],
      audience: config.audience,
      issuer: config.issuer,
    });
    if (typeof payload.sub !== "string" || payload.sub.trim().length === 0) throw new Error("missing sub");
    return {
      sub: payload.sub,
      email: typeof payload.email === "string" ? payload.email : undefined,
    };
  } catch {
    throw new PrivateAccessError();
  }
}

let cachedRemoteKeys: { url: string; key: JWTVerifyGetKey } | undefined;

function cloudflareConfig(environment: NodeJS.ProcessEnv = process.env) {
  const parsed = accessConfigSchema.safeParse({
    teamDomain: environment.CLOUDFLARE_ACCESS_TEAM_DOMAIN,
    audience: environment.CLOUDFLARE_ACCESS_AUD,
  });
  if (!parsed.success) throw new PrivateAccessError();
  const configured = parsed.data.teamDomain.includes("://") ? parsed.data.teamDomain : `https://${parsed.data.teamDomain}`;
  let issuer: string;
  try {
    const url = new URL(configured);
    if (url.protocol !== "https:" || url.pathname !== "/" || url.search || url.hash || !url.hostname.endsWith(".cloudflareaccess.com")) throw new Error("invalid team domain");
    issuer = url.origin;
  } catch { throw new PrivateAccessError(); }
  const jwksUrl = `${issuer}/cdn-cgi/access/certs`;
  if (!cachedRemoteKeys || cachedRemoteKeys.url !== jwksUrl) {
    cachedRemoteKeys = { url: jwksUrl, key: createRemoteJWKSet(new URL(jwksUrl)) };
  }
  return { issuer, audience: parsed.data.audience, key: cachedRemoteKeys.key };
}

export async function requirePrivateAccess(requestHeaders?: Headers, verification?: VerificationConfig): Promise<PrivateIdentity> {
  try {
    const currentHeaders = requestHeaders ?? new Headers(await nextHeaders());
    requireExpectedHost(currentHeaders, loadSecurityConfig().privateOrigin);
    const assertion = currentHeaders.get("cf-access-jwt-assertion");
    if (!assertion) throw new PrivateAccessError();
    return await verifyAccessAssertion(assertion, verification ?? cloudflareConfig());
  } catch (error) {
    if (error instanceof PrivateAccessError) throw error;
    throw new PrivateAccessError();
  }
}

export function parseManagerSubjects(value = process.env.ARCHIVE_SHARE_MANAGER_SUBS): Set<string> {
  return new Set((value ?? "").split(",").map((item) => item.trim()).filter(Boolean));
}

export async function requireShareManager(requestHeaders?: Headers, options: { verification?: VerificationConfig; subjects?: ReadonlySet<string> } = {}): Promise<PrivateIdentity> {
  const identity = await requirePrivateAccess(requestHeaders, options.verification);
  const subjects = options.subjects ?? parseManagerSubjects();
  if (subjects.size === 0 || !subjects.has(identity.sub)) throw new PrivateAccessError();
  return identity;
}

export function identityFromPayload(payload: JWTPayload): PrivateIdentity | undefined {
  return typeof payload.sub === "string" && payload.sub.trim()
    ? { sub: payload.sub, email: typeof payload.email === "string" ? payload.email : undefined }
    : undefined;
}
