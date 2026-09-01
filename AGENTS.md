<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# Deadletter project rules

- Read `.github/copilot-instructions.md` and `DEVELOPMENT.md` before changing architecture or commands.
- Keep filesystem access under `lib/server/` and protect runtime modules with `import "server-only"`.
- Filesystem-backed pages and handlers use the Node.js runtime and request-time rendering; do not add static export or indefinite caching.
- Treat chain slugs and attachment paths as untrusted. Preserve containment, regular-file, and symbolic-link checks.
- Never add private archive contents under `data/chains/`; only its ignored placeholder belongs in Git.
- Run `pnpm validate` before completion. Do not commit, add a remote, or introduce deployment infrastructure unless requested.
