import ErrorState from "@/components/ErrorState";

export default function NotFound() {
  return (
    <main className="page-shell py-16 sm:py-24">
      <p className="eyebrow">404</p>
      <h1 className="mt-3 text-3xl font-semibold tracking-[-0.04em] text-[var(--ink)]">
        Chain not found
      </h1>
      <p className="mt-3 max-w-xl text-base leading-7 text-[var(--muted)]">
        This chain does not exist, or it is not available in the configured archive.
      </p>
      <div className="mt-8">
        <ErrorState
          title="Nothing to display here"
          description="Return to the chain list and choose an available record."
        />
      </div>
    </main>
  );
}
