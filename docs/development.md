# Development

## Requirements

- Node.js 24
- pnpm 11.15.1

Run every command from the repository root.

## Install and run

```bash
pnpm install
cp .env.example .env.local
pnpm dev
```

The safe example configuration reads the fictional archive in
`examples/archive/chains`. Remove `ARCHIVE_DATA_DIR` to use the ignored local
default, `data/chains/`, or point it to a separate real archive location.

Starting `next dev` does not bypass authentication. To browse private archive
pages, use a development hostname protected by the configured Cloudflare Access
application so the request reaches Deadletter with a valid Access assertion.
Direct unauthenticated localhost requests are expected to fail. Repository
validation and unit tests do not require a live Access session.

## Commands

| Task | Command |
| --- | --- |
| Lint | `pnpm lint` |
| Type-check | `pnpm typecheck` |
| Unit/component tests | `pnpm test` |
| Watch tests | `pnpm test:watch` |
| Production build | `pnpm build` |
| Start a build | `pnpm start` |
| Check archive resource IDs | `pnpm archive:resource-ids --check --archive-root <path>` |
| Write missing archive resource IDs | `pnpm archive:resource-ids --write --archive-root <path>` |
| Initialize the share database | `pnpm shares:db init` |
| Full validation | `pnpm validate` |

No separate formatter is configured. `pnpm validate` runs the repository's
canonical lint, type-check, test, and production-build pass.

## Local origins and request-time content

`next dev` restricts development scripts, fonts, and HMR endpoints to known
origins. `ARCHIVE_ALLOWED_DEV_ORIGINS` adds comma-separated reverse-proxy
hostnames without a URL scheme or port. It affects development only.

Pages and handlers that read archive content are dynamic Node.js routes. A
refresh sees normal content edits in both development and `next start`; no
filesystem watcher updates an already-open page.

Private pages require their configured private hostname and a valid Cloudflare
Access assertion. Shared pages require their configured share hostname and a
current scoped grant credential. See [Authentication and sharing](authentication-and-sharing.md)
for the request model and [Deployment](deployment.md) for production setup.

## Archive workflow

Read the [Archive Content Format Specification](archive-content-format.md)
before creating content. Use `examples/archive-template/` as a parseable,
fictional reference. The repository-local `import-email-export` skill provides
an evidence-preserving workflow for importing messy exports.

## Working safely

- Keep filesystem code in `lib/server/` and protect it with `server-only`.
- Do not place real archive content or attachments in `public/`.
- Keep real correspondence, local environment files, share databases, imports,
  logs, and credentials out of Git.
- Preserve the managed section in `AGENTS.md` and generated files such as
  `next-env.d.ts` and `pnpm-lock.yaml`.
- Add focused tests for schema, chronology, authorization, and path-safety
  changes, then run `pnpm validate`.
