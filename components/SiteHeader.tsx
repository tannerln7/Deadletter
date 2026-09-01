"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { ArchiveIcon } from "./Icons";
import ThemeToggle from "./ThemeToggle";

const navigation = [
  {
    href: "/",
    label: "Chains",
    matches: (pathname: string) =>
      pathname === "/" || pathname.startsWith("/chains/") || pathname.startsWith("/collections/"),
  },
  { href: "/files", label: "Files", matches: (pathname: string) => pathname === "/files" },
];

export default function SiteHeader() {
  const pathname = usePathname();

  return (
    <header className="sticky top-0 z-30 border-b border-[var(--line)] bg-[var(--header-background)] backdrop-blur">
      <div className="mx-auto flex h-16 w-full max-w-6xl items-center justify-between px-4 sm:px-8">
        <Link
          href="/"
          aria-label="Deadletter home"
          className="inline-flex min-h-11 shrink-0 items-center gap-2.5 rounded-md font-semibold tracking-[-0.02em] text-[var(--ink)] outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] focus-visible:ring-offset-2"
        >
          <ArchiveIcon className="size-5 text-[var(--accent)]" />
          <span>Deadletter</span>
        </Link>
        <nav aria-label="Primary" className="flex h-full items-center gap-1 sm:gap-3">
          {navigation.map((item) => {
            const isActive = item.matches(pathname);

            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={isActive ? "page" : undefined}
                className={`relative inline-flex h-full min-w-14 items-center justify-center px-2 text-sm font-medium outline-none transition-colors focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--accent)] ${
                  isActive
                    ? "text-[var(--ink)] after:absolute after:inset-x-2 after:bottom-0 after:h-0.5 after:bg-[var(--accent)]"
                    : "text-[var(--muted)] hover:text-[var(--ink)]"
                }`}
              >
                {item.label}
              </Link>
            );
          })}
          <ThemeToggle />
        </nav>
      </div>
    </header>
  );
}
