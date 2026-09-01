---
applyTo: "**/**/*.ts,**/**/*.tsx,**/**/*.js,**/**/*.jsx,**/**/*.mts,**/**/*.cts"
---

# web application instructions

- Component root: `.`
- Stack: typescript
- Project kind: application
- Read `README.md`, `DEVELOPMENT.md`, the nearest manifest, and existing tests before changing implementation.
- Run component commands from its component root.
- Do not edit generated dependency or build output directly.
- Keep Client Component boundaries narrow and never import `lib/server/` runtime modules into them.
- Preserve mobile-first semantic markup and keyboard-accessible controls.
- setup: `pnpm install`
- run: `pnpm dev`
- lint: `pnpm lint`
- typecheck: `pnpm typecheck`
- test: `pnpm test`
- build: `pnpm build`
