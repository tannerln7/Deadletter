// @vitest-environment jsdom

import { cleanup, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import ShareControls from "@/components/ShareControls";

afterEach(() => { cleanup(); vi.restoreAllMocks(); });

describe("share management controls", () => {
  it("opens an accessible modal, contains focus, closes with Escape, and restores focus", async () => {
    const user = userEvent.setup();
    render(<ShareControls initialActive={false} resourceId="11111111-1111-4111-8111-111111111111" resourceKind="collection" />);
    const trigger = screen.getByRole("button", { name: "Share" });
    await user.click(trigger);
    const dialog = screen.getByRole("dialog", { name: "Create public link?" });
    expect(dialog).toBeTruthy();
    for (let index = 0; index < 5; index += 1) {
      await user.tab();
      expect(dialog.contains(document.activeElement)).toBe(true);
    }
    await user.keyboard("{Escape}");
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(document.activeElement).toBe(trigger);
  });

  it("creates a link, displays the credential once, and reports clipboard success", async () => {
    const user = userEvent.setup();
    vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(JSON.stringify({ active: true, grantId: "grant-one", shareUrl: "https://share.example.test/s/secret" }), { status: 201, headers: { "Content-Type": "application/json" } }));
    render(<ShareControls initialActive={false} resourceId="11111111-1111-4111-8111-111111111111" resourceKind="collection" />);
    await user.click(screen.getByRole("button", { name: "Share" }));
    await user.click(screen.getByRole("button", { name: "Create link" }));
    const dialog = await screen.findByRole("dialog", { name: "Share link created" });
    expect(within(dialog).getByDisplayValue("https://share.example.test/s/secret")).toBeTruthy();
    await user.click(within(dialog).getByRole("button", { name: "Copy link" }));
    expect(within(dialog).getByText("Link copied.").getAttribute("aria-live")).toBe("polite");
    expect(fetch).toHaveBeenCalledWith("/api/shares", expect.objectContaining({ method: "POST", cache: "no-store" }));
  });

  it("confirms regeneration and revocation", async () => {
    const user = userEvent.setup();
    vi.spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(new Response(JSON.stringify({ active: true, grantId: "grant-one", shareUrl: "https://share.example.test/s/new" }), { status: 200, headers: { "Content-Type": "application/json" } }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ active: false }), { status: 200, headers: { "Content-Type": "application/json" } }));
    render(<ShareControls initialActive initialGrantId="grant-one" resourceId="22222222-2222-4222-8222-222222222222" resourceKind="chain" />);
    await user.click(screen.getByRole("button", { name: "Regenerate" }));
    expect(screen.getByRole("alertdialog", { name: "Regenerate public link?" })).toBeTruthy();
    await user.click(within(screen.getByRole("alertdialog")).getByRole("button", { name: "Regenerate" }));
    await screen.findByDisplayValue("https://share.example.test/s/new");
    await user.click(screen.getByRole("button", { name: "Close" }));
    await user.click(screen.getByRole("button", { name: "Revoke" }));
    await user.click(within(screen.getByRole("alertdialog")).getByRole("button", { name: "Revoke" }));
    await waitFor(() => expect(screen.getByText("Share revoked.")).toBeTruthy());
    expect(screen.getByRole("button", { name: "Share" })).toBeTruthy();
  });
});
