export default function SharedNotFound() {
  return (
    <main className="page-shell py-16 sm:py-24">
      <section className="mx-auto max-w-xl rounded-xl border border-[var(--line-strong)] bg-[var(--surface)] p-6 text-center sm:p-8">
        <p className="eyebrow">Shared archive</p>
        <h1 className="mt-3 text-2xl font-semibold text-[var(--ink)]">Shared item not found</h1>
        <p className="mt-3 text-sm leading-6 text-[var(--muted)]">
          This link is invalid, expired, revoked, or no longer includes the requested item.
        </p>
      </section>
    </main>
  );
}
