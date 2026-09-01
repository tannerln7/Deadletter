import { createLocalJWKSet, exportJWK, generateKeyPair, SignJWT } from "jose";
import { describe, expect, it } from "vitest";

import { loadSecurityConfig, requireExpectedHost } from "@/lib/server/security/config";
import { parseManagerSubjects, PrivateAccessError, requirePrivateAccess, requireShareManager, verifyAccessAssertion } from "@/lib/server/security/private-access";

async function fixture() {
  const { privateKey, publicKey } = await generateKeyPair("RS256", { modulusLength: 2048 });
  const jwk = await exportJWK(publicKey);
  jwk.alg = "RS256";
  jwk.kid = "test-key";
  const key = createLocalJWKSet({ keys: [jwk] });
  const sign = (claims: Record<string, unknown> = {}, options: { issuer?: string; audience?: string; expires?: string; notBefore?: string } = {}) => {
    let token = new SignJWT({ email: "manager@example.test", ...claims })
    .setProtectedHeader({ alg: "RS256", kid: "test-key" })
    .setIssuer(options.issuer ?? "https://team.cloudflareaccess.com")
    .setAudience(options.audience ?? "archive-aud")
    .setIssuedAt()
    .setExpirationTime(options.expires ?? "5m");
    if (options.notBefore) token = token.setNotBefore(options.notBefore);
    return token.sign(privateKey);
  };
  return { key, sign };
}

describe("Cloudflare Access authorization", () => {
  it("accepts a valid assertion and returns only minimal identity", async () => {
    const { key, sign } = await fixture();
    await expect(verifyAccessAssertion(await sign({ sub: "stable-sub" }), { issuer: "https://team.cloudflareaccess.com", audience: "archive-aud", key })).resolves.toEqual({ sub: "stable-sub", email: "manager@example.test" });
  });

  it.each([
    ["wrong issuer", { issuer: "https://other.cloudflareaccess.com" }, {}],
    ["wrong audience", { audience: "other-aud" }, {}],
    ["expired", { expires: "-1s" }, {}],
    ["not yet valid", { notBefore: "5m" }, { sub: "stable-sub" }],
    ["missing subject", {}, {}],
  ])("rejects %s", async (_label, signing, claims) => {
    const { key, sign } = await fixture();
    await expect(verifyAccessAssertion(await sign(claims, signing), { issuer: "https://team.cloudflareaccess.com", audience: "archive-aud", key })).rejects.toBeInstanceOf(PrivateAccessError);
  });

  it("rejects a token signed by an unknown key", async () => {
    const trusted = await fixture();
    const attacker = await fixture();
    await expect(verifyAccessAssertion(await attacker.sign({ sub: "stable-sub" }), { issuer: "https://team.cloudflareaccess.com", audience: "archive-aud", key: trusted.key })).rejects.toBeInstanceOf(PrivateAccessError);
  });

  it("requires configured canonical hosts and ignores forwarded-host", () => {
    const config = loadSecurityConfig({ ARCHIVE_PRIVATE_ORIGIN: "https://archive.example.test", ARCHIVE_SHARE_ORIGIN: "https://share.example.test" });
    expect(() => requireExpectedHost(new Headers({ host: "archive.example.test", "x-forwarded-host": "share.example.test" }), config.privateOrigin)).not.toThrow();
    expect(() => requireExpectedHost(new Headers({ host: "other.example.test", "x-forwarded-host": "archive.example.test" }), config.privateOrigin)).toThrow();
  });

  it("parses manager subjects as an exact fail-closed allowlist", () => {
    expect(parseManagerSubjects(undefined).size).toBe(0);
    expect(parseManagerSubjects("sub-one, sub-two")).toEqual(new Set(["sub-one", "sub-two"]));
  });

  it("enforces missing assertions, canonical host, and manager identity at the actual boundaries", async () => {
    const { key, sign } = await fixture();
    const verification = { issuer: "https://team.cloudflareaccess.com", audience: "archive-aud", key };
    const environment = { ARCHIVE_PRIVATE_ORIGIN: "https://archive.example.test", ARCHIVE_SHARE_ORIGIN: "https://share.example.test" };
    const previous = { privateOrigin: process.env.ARCHIVE_PRIVATE_ORIGIN, shareOrigin: process.env.ARCHIVE_SHARE_ORIGIN };
    process.env.ARCHIVE_PRIVATE_ORIGIN = environment.ARCHIVE_PRIVATE_ORIGIN;
    process.env.ARCHIVE_SHARE_ORIGIN = environment.ARCHIVE_SHARE_ORIGIN;
    try {
      await expect(requirePrivateAccess(new Headers({ host: "archive.example.test" }), verification)).rejects.toBeInstanceOf(PrivateAccessError);
      const assertion = await sign({ sub: "stable-sub" });
      await expect(requirePrivateAccess(new Headers({ host: "share.example.test", "cf-access-jwt-assertion": assertion }), verification)).rejects.toBeInstanceOf(PrivateAccessError);
      const headers = new Headers({ host: "archive.example.test", "cf-access-jwt-assertion": assertion });
      await expect(requireShareManager(headers, { verification, subjects: new Set() })).rejects.toBeInstanceOf(PrivateAccessError);
      await expect(requireShareManager(headers, { verification, subjects: new Set(["stable-sub"]) })).resolves.toMatchObject({ sub: "stable-sub" });
    } finally {
      if (previous.privateOrigin === undefined) delete process.env.ARCHIVE_PRIVATE_ORIGIN; else process.env.ARCHIVE_PRIVATE_ORIGIN = previous.privateOrigin;
      if (previous.shareOrigin === undefined) delete process.env.ARCHIVE_SHARE_ORIGIN; else process.env.ARCHIVE_SHARE_ORIGIN = previous.shareOrigin;
    }
  });
});
