// @vitest-environment jsdom

import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import SiteHeader from "@/components/SiteHeader";

vi.mock("next/link", () => ({
  default: ({ children, ...props }: React.AnchorHTMLAttributes<HTMLAnchorElement>) => (
    <a {...props}>{children}</a>
  ),
}));

vi.mock("next/navigation", () => ({
  usePathname: () => "/",
}));

afterEach(cleanup);

describe("site branding", () => {
  it("shows Deadletter in the primary header at every viewport", () => {
    render(<SiteHeader />);

    const homeLink = screen.getByRole("link", { name: "Deadletter home" });
    const brandName = screen.getByText("Deadletter");

    expect(homeLink.getAttribute("href")).toBe("/");
    expect(homeLink.contains(brandName)).toBe(true);
    expect(brandName.className).not.toContain("hidden");
  });
});
