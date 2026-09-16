# Deadletter

> Correspondence, reconstructed.

Deadletter turns scattered email threads and attachments into structured,
browsable, shareable archives. It is a self-hosted Next.js application for
people who need a durable, readable record of correspondence without adopting a
mail server, CMS, or general-purpose file manager.

Archive content remains on the server filesystem: one Markdown file per email
or document, with original attachments kept alongside it. Deadletter validates
that structure, presents entries as a chronological timeline, and streams files
through constrained, path-safe routes. A bundled coding-agent skill provides
the intended workflow for turning messy user-supplied exports into that
canonical structure.

## Why Deadletter

Email exports are difficult to navigate: messages are buried in PDFs, quoted
history repeats, and attachments become separated from their context.
Deadletter provides a deliberately small archival format and a focused reader
for preserving that context. Its filesystem-first model keeps records portable,
reviewable, and independent of a database for archive content itself.

## Features

- Filesystem-backed email and document chains with validated YAML frontmatter.
- Optional collections and categories without moving chain folders.
- Responsive timelines with GitHub-flavored Markdown and practical previews.
- Safe attachment streaming and a focused cross-chain file browser.
- Request-time filesystem reads so normal content changes appear on refresh.
- Agent-guided import of PDF, text, and Markdown exports with attachment
  matching, deduplication, and evidence-preserving cleanup.
- Light and dark themes.
- Cloudflare Access verification for private application routes.
- Revocable, scoped share links for one live chain or collection.

## Architecture at a glance

```text
Markdown + attachment files
          │
          ▼
  Deadletter archive loaders ──► Next.js reader and file routes
          │                              │
          └── archive.yml / chain.yml    ├── Cloudflare Access private host
                                         └── scoped public share host
```

Archive records remain ordinary files. SQLite is used only for revocable share
grant state, never as the archive-content store. Read [Architecture](docs/architecture.md)
for the model and boundaries.

## Requirements

- Node.js 24
- pnpm 11.15.1
- A filesystem location the Node process can read for archive content

Authentication uses Cloudflare Access in every environment that serves private
archive data. Local development normally uses the fictional fixtures and the
safe values in `.env.example`, but Deadletter intentionally provides no
unauthenticated development bypass.

## Quick start

```bash
pnpm install
cp .env.example .env.local
pnpm dev
```

The example configuration points `ARCHIVE_DATA_DIR` at committed fictional
fixtures. `pnpm dev` starts the development server, but browsing private pages
still requires a configured private hostname and a valid Cloudflare Access
assertion. Direct unauthenticated localhost requests are expected to fail.
Keep real correspondence outside Git and out of `public/`.

For detailed local setup, development-origin behavior, test commands, and
resource-ID tooling, read [Development](docs/development.md).

## Import with a coding agent

Deadletter deliberately has no upload screen or automatic mailbox importer.
Instead, a local coding agent such as Codex or Claude Code uses the bundled
[`import-email-export` skill](.github/skills/import-email-export/SKILL.md) to
inspect exports, reconstruct individual messages, associate original
attachments, and write validated archive files. The original source material
stays read-only and local unless you explicitly authorize otherwise.

Install the repository-local discovery link for your agent from the repository
root. The canonical skill remains under `.github/skills/`; these links do not
create a second maintained copy.

**Codex**

```bash
mkdir -p .agents/skills
ln -s ../../.github/skills/import-email-export .agents/skills/import-email-export
```

**Claude Code**

```bash
mkdir -p .claude/skills
ln -s ../../.github/skills/import-email-export .claude/skills/import-email-export
```

Start a new agent session if the skill is not discovered immediately. Then ask
the agent to use `import-email-export` and provide:

- the local path or paths to the email export files;
- the original attachment files, when available;
- the desired chain title and whether it is new or existing;
- the archive root and optional collection/category placement;
- the source timezone, especially when exported timestamps omit offsets; and
- whether existing archive entries may be corrected or replaced.

The agent inventories and deduplicates messages, reports unresolved metadata or
attachment ownership instead of guessing, writes or stages the archive tree,
and runs the repository's existing validation. You remain responsible for the
final content review. See [Agent-assisted imports](docs/agent-assisted-imports.md)
for prompts, preparation, safety rules, and the complete interaction model.

## Archive content

An archive root contains flat chain directories. Each chain has a `chain.yml`,
an `emails/` directory of Markdown entries, and referenced files below the same
chain directory. An optional root `archive.yml` groups chains into collections
and categories.

```text
archive-root/
├── archive.yml
└── example-chain/
    ├── chain.yml
    ├── emails/
    │   └── 2026-01-15_0900_example-message.md
    └── attachments/
        └── 2026-01-15_0900/
            └── example-note.txt
```

The full, executable-format-aligned contract is the
[Archive Content Format Specification](docs/archive-content-format.md).
Copyable fictional input lives in `examples/archive-template/`.

## Configuration and deployment

`ARCHIVE_DATA_DIR` may be an absolute archive path or a path relative to the
repository root. The default is `data/chains/`, which is intentionally ignored
by Git except for an empty placeholder.

Production runs as a Node server:

```bash
pnpm build
pnpm start
```

Deadletter expects a private canonical hostname protected by Cloudflare Access.
Its optional public share hostname is deliberately separate and exposes only
scoped share routes. Deployment environment, state, Tunnel behavior, and
release sequencing are documented in [Deployment](docs/deployment.md).

## Authentication and sharing

Private archive data requires both Cloudflare Access at the edge and an
application-side verification of the Access JWT. Share links are separate,
bearer-capability URLs for a specifically granted live chain or collection.
They are revocable, credential secrets are stored only as digests, and shared
file access is reauthorized on every request.

Read [Authentication and sharing](docs/authentication-and-sharing.md) before
enabling public links.

## Development and validation

```bash
pnpm lint
pnpm typecheck
pnpm test
pnpm build
pnpm validate
```

`pnpm validate` is the complete repository check. See
[Development](docs/development.md) for the canonical command reference.

## Documentation

- [Architecture](docs/architecture.md)
- [Agent-assisted imports](docs/agent-assisted-imports.md)
- [Archive content format](docs/archive-content-format.md)
- [Authentication and sharing](docs/authentication-and-sharing.md)
- [Deployment](docs/deployment.md)
- [Development](docs/development.md)

## Security

Do not commit real correspondence, attachments, credentials, SQLite state, or
production configuration. Archive and attachment paths are untrusted input;
Deadletter validates containment, rejects traversal and symlink escapes, and
never serves archive files from `public/`. HTML and SVG attachments download
rather than render on the application origin.

The project assumes a correctly configured private Cloudflare Access application
and protected origin. Application code independently enforces its private and
share authorization boundaries; deployment must preserve those boundaries.

## Status

Deadletter is a self-hosted archive reader with a stable filesystem content
contract. It intentionally does not provide automatic mailbox ingestion,
upload/edit/delete interfaces, full-text search, an archive database, custom
Office/PDF rendering, or a general document-management feature set. Import is
an explicit, reviewable local-agent workflow rather than an application
feature.

## Contributing

Focused improvements are welcome. Preserve the filesystem archive contract,
server-only boundary, and path-safety guarantees. Start with
[Development](docs/development.md) and repository-local contributor guidance.

## License

Deadletter is released under the [MIT License](LICENSE).
