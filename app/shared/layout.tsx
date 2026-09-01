import { ArchiveIcon } from "@/components/Icons";
import SharedAttribution from "@/components/SharedAttribution";

export default function SharedLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col">
      <header className="border-b border-[var(--line)] bg-[var(--header-background)]">
        <div className="mx-auto flex h-16 w-full max-w-6xl items-center px-4 sm:px-8">
          <div className="inline-flex items-center gap-2.5 font-semibold tracking-[-0.02em] text-[var(--ink)]">
            <ArchiveIcon className="size-5 text-[var(--accent)]" />
            <span>Deadletter</span>
          </div>
        </div>
      </header>
      <div className="flex-1">{children}</div>
      <SharedAttribution />
    </div>
  );
}
