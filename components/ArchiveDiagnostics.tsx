import type { ArchiveDiagnostic } from "@/lib/server/types";

import { WarningIcon } from "./Icons";

export default function ArchiveDiagnostics({
  diagnostics,
}: {
  diagnostics: readonly ArchiveDiagnostic[];
}) {
  if (diagnostics.length === 0) return null;

  return (
    <aside
      aria-labelledby="archive-warnings-title"
      className="border-l-2 border-[var(--accent)] bg-[var(--accent-soft)] px-5 py-5"
    >
      <div className="flex gap-3">
        <WarningIcon className="mt-0.5 size-5 shrink-0 text-[var(--accent-strong)]" />
        <div className="min-w-0">
          <h2 id="archive-warnings-title" className="font-semibold text-[var(--ink)]">
            Some archive content needs attention
          </h2>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-sm leading-6 text-[var(--muted)]">
            {diagnostics.map((diagnostic, index) => (
              <li key={`${diagnostic.code}:${diagnostic.chainSlug ?? "archive"}:${index}`}>
                {diagnostic.chainSlug ? `${diagnostic.chainSlug}: ` : ""}
                {diagnostic.message}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </aside>
  );
}
