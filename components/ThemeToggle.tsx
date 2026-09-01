"use client";

import { MoonIcon, SunIcon } from "./Icons";

const themeStorageKey = "deadletter-theme";

export default function ThemeToggle() {
  const toggleTheme = () => {
    const root = document.documentElement;
    const nextTheme = root.dataset.theme === "dark" ? "light" : "dark";

    root.dataset.theme = nextTheme;
    try {
      localStorage.setItem(themeStorageKey, nextTheme);
    } catch {
      // The selected theme still applies for this page when storage is unavailable.
    }
  };

  return (
    <button
      type="button"
      aria-label="Toggle color theme"
      title="Toggle color theme"
      className="inline-flex size-11 shrink-0 items-center justify-center rounded-md border border-[var(--line)] bg-[var(--surface-subtle)] text-[var(--muted)] outline-none hover:border-[var(--accent)] hover:text-[var(--ink)] focus-visible:ring-2 focus-visible:ring-[var(--accent)] focus-visible:ring-offset-2 md:w-auto md:px-3"
      onClick={toggleTheme}
    >
      <span className="theme-light-indicator" aria-hidden="true">
        <SunIcon className="size-4" />
        <span className="hidden md:inline">Light</span>
      </span>
      <span className="theme-dark-indicator" aria-hidden="true">
        <MoonIcon className="size-4" />
        <span className="hidden md:inline">Dark</span>
      </span>
    </button>
  );
}
