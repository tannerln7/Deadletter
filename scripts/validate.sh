#!/usr/bin/env bash
set -euo pipefail

repo_root="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$repo_root"

printf '\n==> Lint\n'
pnpm lint

printf '\n==> TypeScript\n'
pnpm typecheck

printf '\n==> Focused unit tests\n'
pnpm test

printf '\n==> Production build\n'
pnpm build

printf '\nAll configured repository checks passed.\n'
