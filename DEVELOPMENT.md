# Development entry point

This file remains a short compatibility entry point for repository-local agent
instructions. The public developer guide is [docs/development.md](docs/development.md).

Run commands from the repository root.

| Task | Command |
| --- | --- |
| Install | `pnpm install` |
| Develop | `pnpm dev` |
| Lint | `pnpm lint` |
| Type-check | `pnpm typecheck` |
| Test | `pnpm test` |
| Build | `pnpm build` |
| Full validation | `pnpm validate` |

Keep real archives, `.env.local`, production databases, source exports, and
credentials out of Git. The detailed archive contract is the
[Archive Content Format Specification](docs/archive-content-format.md); share
and deployment procedures are documented under `docs/`. For the intended
coding-agent ingestion workflow, see
[Agent-assisted imports](docs/agent-assisted-imports.md).
