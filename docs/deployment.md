# Deployment

Deadletter is a self-hosted Node.js application. This guide describes the
expected production topology and a fail-closed rollout for private access and
optional public sharing.

## Production environment

Configure production values in the service environment; do not commit them.

```dotenv
ARCHIVE_DATA_DIR=/absolute/path/to/archive/chains
ARCHIVE_PRIVATE_ORIGIN=https://archive.example.com
ARCHIVE_SHARE_ORIGIN=https://share.example.com
CLOUDFLARE_ACCESS_TEAM_DOMAIN=team-name.cloudflareaccess.com
CLOUDFLARE_ACCESS_AUD=replace-with-private-access-application-audience
ARCHIVE_SHARE_MANAGER_SUBS=verified-access-subject-1,verified-access-subject-2
ARCHIVE_SHARE_DB=/var/lib/deadletter/shares.sqlite
```

The private and share origins must be distinct canonical HTTPS origins without
paths, queries, or fragments. An empty `ARCHIVE_SHARE_MANAGER_SUBS` allowlist
disables link management. Use verified Cloudflare Access `sub` values, not email
addresses, as manager identities.

## Service and persistent state

Run the production build with Node.js:

```bash
pnpm build
pnpm start
```

Share state is a small SQLite database containing grant metadata and credential
digests, never raw link secrets or archive content. Keep it outside Git and the
archive root. The application does not initialize or migrate it during module
import or `next build`; initialize it explicitly after deploying compatible
code:

```bash
pnpm shares:db init
```

A systemd-managed deployment should provide a restrictive state directory, for
example:

```ini
[Service]
StateDirectory=deadletter
StateDirectoryMode=0700
```

Then set `ARCHIVE_SHARE_DB=/var/lib/deadletter/shares.sqlite`. Existing
installations using older service or state-directory names should migrate them
in a separately planned maintenance change; renaming is not required as part of
an application release.

If the share database is missing, unreadable, corrupt, or has an unsupported
schema, private archive browsing remains available, share management reports
unavailable, and public sharing fails closed.

## Cloudflare topology

Both public hostnames can route through the same Cloudflare Tunnel to the same
Next.js process. Tunnel origin-request behavior must preserve the corresponding
public hostname in the origin `Host`; do not rewrite both hostnames to one
value. The application rejects unknown hosts and private/share route mixtures.

### Required for correctness and security

- Protect the private hostname with a self-hosted Cloudflare Access application
  and an allow policy.
- Leave the share hostname outside that Access application. If an account-wide
  Access requirement would otherwise include it, use a narrowly scoped Access
  application with an Everyone Bypass policy for the share hostname.
- Configure the Access team domain and audience in the service environment.
- Bypass Cloudflare caching for the share hostname.
- Do not expose another direct public route to the Node process.

### Recommended defense in depth

- Rate limit one-time share exchanges under `/s/*` at the Cloudflare edge.
- Redact bearer-exchange paths from proxy, Tunnel, analytics, and log exports
  where supported.
- Monitor authorization failures, unexpected origin hosts, SQLite availability,
  and grant mutations without logging credentials or archive content.

Official Cloudflare references:

- [Validate Cloudflare Access JWTs](https://developers.cloudflare.com/cloudflare-one/access-controls/applications/http-apps/authorization-cookie/validating-json/)
- [Tunnel origin parameters](https://developers.cloudflare.com/cloudflare-one/networks/connectors/cloudflare-tunnel/configure-tunnels/origin-parameters/)
- [Access policies and Bypass](https://developers.cloudflare.com/cloudflare-one/access-controls/policies/)
- [Require Access protection](https://developers.cloudflare.com/cloudflare-one/access-controls/access-settings/require-access-protection/)
- [Cache Rules settings](https://developers.cloudflare.com/cache/how-to/cache-rules/settings/)

## Resource-ID migration

Share grants use immutable resource IDs rather than editable slugs. Before
enabling sharing for an existing archive:

```bash
pnpm archive:resource-ids --check --archive-root /absolute/path/to/archive/chains
pnpm archive:resource-ids --write --archive-root /absolute/path/to/archive/chains
pnpm archive:resource-ids --check --archive-root /absolute/path/to/archive/chains
```

The write mode validates manifests before mutation, preserves valid IDs,
generates missing IDs in memory, verifies uniqueness, and uses atomic file
replacement. Back up the archive before production writes. Do not hand-edit or
reuse a resource ID.

## Backup and restore

Use a SQLite-aware online backup mechanism or stop the service cleanly before
copying SQLite state; copying only the main database during WAL writes is not a
reliable backup. Treat a restored database as credential-sensitive state: it
can resurrect historical credential digests.

After restoring sharing state, keep the share hostname disabled, validate the
database, revoke all active grants, restart and verify the private application,
then re-enable sharing and create new links as needed:

```bash
pnpm shares:db revoke-all
```

## Fail-closed rollout

1. Back up the archive and deploy the compatibility release that accepts missing
   resource IDs. Keep the share hostname disabled.
2. Check, write, and recheck resource IDs against the live archive.
3. Deploy the final application with required environment values and verify the
   private hostname requires both Cloudflare Access and application JWT
   validation.
4. Create the service-owned state directory, initialize SQLite, and verify the
   service user can access it.
5. Configure share DNS/Tunnel host preservation, Access scope, cache bypass,
   and rate limiting while the share hostname remains blocked.
6. Verify host and route isolation plus required framework assets.
7. Create one sanitized test share and verify exchange, scoped navigation,
   preview/download, regeneration, revocation, and multiple-browser-tab use.
8. Enable real share creation only after the controlled test succeeds.

A bare local-port request is not a production health check: expected host and
authorization values are intentionally required.
