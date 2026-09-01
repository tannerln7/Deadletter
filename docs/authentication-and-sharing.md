# Authentication and sharing

Deadletter has two deliberate paths to archive data:

1. A verified Cloudflare Access identity on the private hostname.
2. An active, scoped bearer share credential on the separate share hostname.

There is no independent application login or session framework. Cloudflare
Access supplies private identity, and the application cryptographically verifies
the Access JWT before it returns private archive data.

## Private access

The private hostname is protected by a Cloudflare Access application. At the
application boundary, the request must present a valid
`Cf-Access-Jwt-Assertion` with the configured issuer, audience, signing
algorithm, time claims, and subject. Host and route classification reject
incorrect private/share combinations early; authoritative authorization remains
close to archive data access.

Share management is a more sensitive private action. Only verified Access
subjects listed in `ARCHIVE_SHARE_MANAGER_SUBS` may create, regenerate, or
revoke share links. Management route handlers additionally require the expected
private Origin, JSON requests, and a project-specific same-origin request
header.

## Share links

A share grant targets one immutable chain or collection `resourceId`. A fresh
256-bit random secret is delivered only when a link is created or regenerated;
the database stores only a SHA-256 digest. The URL first exchanges that secret
for a host-only, secure, HttpOnly cookie scoped to the grant's `/shared/<id>`
path. Subsequent URLs do not contain the secret.

Each shared request validates the configured share host, grant state, expiry,
grant-scoped cookie, current credential digest, and resource scope. For a
collection, current membership is resolved from archive manifests on the
request: added chains become available and removed chains cease to be available
without changing the grant.

Regenerating a link replaces its credential immediately. Revocation is
permanent; a later decision to share the same resource creates a new grant.
Already rendered or downloaded bytes cannot be recalled, but every request
started after the revoke or regeneration transaction commits is denied.

## Shared files and cache behavior

Shared file URLs remain below the grant-scoped shared route. A file request must
be in a currently authorized chain and match an attachment referenced by a valid
entry. It also passes the standard containment, symlink, regular-file, MIME,
and disposition checks.

Shared pages, exchange responses, and files use `private, no-store` cache
controls. Cloudflare must also bypass caching for the share hostname. Shared
navigation uses ordinary links rather than speculative Next.js navigation so
fresh server requests revalidate the grant.

## Operations

The required Cloudflare Access, Tunnel, SQLite, backup/restore, migration, and
fail-closed rollout procedures are in [Deployment](deployment.md). The archive
resource IDs and collection model are defined in
[Archive Content Format Specification](archive-content-format.md).
