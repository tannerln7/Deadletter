# Deadletter repository instructions

Deadletter is a private, self-hosted Next.js application for reading filesystem-backed email and document chains. It is not a CMS, upload system, or general-purpose file manager.

Read `README.md` for the public project overview, `docs/archive-content-format.md`
for the content contract, and `docs/development.md` for canonical commands.

## Architecture invariants

- Use the App Router, React, strict TypeScript, Tailwind CSS, pnpm, and the framework-default Turbopack setup.
- Keep `app/` at the repository root. Do not introduce `src/`, static export, Edge runtime, an ORM, CMS, object storage, or an independent login/session framework. Cloudflare Access JWT verification and the built-in SQLite share-grant store are the approved authentication/sharing architecture.
- Keep filesystem access in `lib/server/` modules protected by `import "server-only"`. Client components must not import filesystem modules or Node runtime APIs.
- Mark every filesystem-backed page and route handler with the Node.js runtime and request-time rendering. Do not use static params or indefinite caching for archive content.
- Treat Markdown as untrusted data. Use `react-markdown` without raw HTML support. Sanitize or isolate HTML before any future inline preview.

## Private files and path safety

- Never add real emails, attachments, identities, claim numbers, credentials, or account data. Use `.example.test` and synthetic fixtures only.
- Keep `data/chains/*` ignored except `.gitkeep`. Archive files may live outside Git through `ARCHIVE_DATA_DIR`.
- Treat chain slugs and path segments as untrusted. Reject malformed encoding, absolute paths, separators inside a segment, empty or dot segments, traversal, directories, and symbolic-link escapes.
- Prove containment against both normalized paths and real paths. Do not reveal absolute filesystem details in responses.
- Stream attachment responses through the protected route, derive MIME from the resolved file, sanitize disposition filenames, force HTML/SVG downloads, and never move sensitive content into `public/`.

## Authentication and sharing

- Archive data has exactly two authorization paths: a verified Cloudflare Access identity on the configured private host, or an active scoped share credential on the configured share host.
- `proxy.ts` performs early host/path isolation only. Authoritative checks stay close to data access in `lib/server/security/` and `lib/server/shares/`; generic archive loaders remain authorization-agnostic.
- Share grants use stable manifest `resourceId` values. Preserve assigned IDs across renames and never regenerate or reuse them deliberately.
- Shared files must be referenced attachments inside the currently authorized live chain/collection scope. Filesystem containment alone is not share authorization.
- Do not cache shared data, leak bearer secrets into post-exchange URLs or logs, or derive canonical origins from forwarded-host headers.

## Content failure policy

- Index discovery excludes an invalid chain and surfaces a safe diagnostic; direct chain loading fails clearly. Invalid root organization metadata or unknown membership references retain otherwise valid chains as ungrouped with safe diagnostics. Do not silently repair metadata.
- Attachment fields are `title`, chain-relative `file`, and MIME `type`. Dates require an explicit ISO 8601 timezone.

## Validation

Add focused tests for schema, sorting, archive-root, and path-safety changes. Run `pnpm validate` before completion and report skipped or failed checks. Preserve unrelated work and leave Git operations, remotes, deployment, and commits to explicit user requests.
