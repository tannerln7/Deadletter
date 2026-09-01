---
applyTo: "lib/server/**/*.ts,app/api/files/**/*.ts,app/chains/**/*.tsx,app/files/**/*.tsx,app/page.tsx,test/**/*.ts"
---

# Filesystem archive instructions

- Filesystem-backed route modules explicitly export `runtime = "nodejs"` and request-time rendering configuration.
- Runtime modules in `lib/server/` import `server-only`; keep reusable erased types free of runtime server imports.
- Resolve `ARCHIVE_DATA_DIR` relative to the repository root unless it is absolute.
- Validate chain slugs and path segments before filesystem access. Preserve lexical containment, real-path containment, regular-file checks, and symbolic-link escape rejection.
- Return generic invalid/not-found responses. Never expose an absolute path or private metadata.
- Use sanitized, temporary test files and add regression coverage for security boundary changes.
