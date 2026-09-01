// @vitest-environment jsdom

import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import SharedLayout from "@/app/shared/layout";
import EmailChainViewer from "@/components/EmailChainViewer";
import type {
  ArchiveChainSummary,
  ArchiveEmail,
  ChainManifest,
} from "@/lib/server/types";

vi.mock("next/link", () => ({
  default: ({ children, ...props }: React.AnchorHTMLAttributes<HTMLAnchorElement>) => (
    <a {...props}>{children}</a>
  ),
}));

class ImmediateIntersectionObserver implements IntersectionObserver {
  readonly root = null;
  readonly rootMargin = "600px 0px";
  readonly thresholds = [0];

  constructor(private readonly callback: IntersectionObserverCallback) {}

  disconnect() {}
  takeRecords() { return []; }
  unobserve() {}

  observe(target: Element) {
    this.callback(
      [{ isIntersecting: true, target } as IntersectionObserverEntry],
      this,
    );
  }
}

const manifest: ChainManifest = {
  slug: "example-chain",
  title: "Example chain",
};

const summary: ArchiveChainSummary = {
  ...manifest,
  attachmentCount: 1,
  entryCount: 1,
};

const entries: ArchiveEmail[] = [
  {
    id: "example-entry",
    chain: manifest.slug,
    date: "2026-01-01T09:00:00-05:00",
    from: "Sender <sender@example.test>",
    to: ["Recipient <recipient@example.test>"],
    subject: "Example entry",
    attachments: [
      {
        title: "Example note",
        file: "attachments/example note.txt",
        type: "text/plain",
      },
    ],
    body: "Example body.",
    sourceFile: "example-entry.md",
  },
];

beforeEach(() => {
  vi.stubGlobal("IntersectionObserver", ImmediateIntersectionObserver);
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("shared public presentation", () => {
  it("renders the shared-only GitHub attribution", () => {
    const { container } = render(
      <SharedLayout>
        <main>Shared archive</main>
      </SharedLayout>,
    );

    expect(screen.getByText("Deadletter")).toBeTruthy();
    expect(screen.getByText("Built by")).toBeTruthy();
    const profile = screen.getByRole("link", {
      name: "Tanner Lane on GitHub (opens in a new tab)",
    });
    expect(profile.getAttribute("href")).toBe("https://github.com/tannerln7");
    expect(profile.getAttribute("target")).toBe("_blank");
    expect(profile.getAttribute("rel")).toBe("noreferrer noopener");
    expect(profile.querySelector("svg")).toBeTruthy();
    expect(container.querySelector("img")).toBeNull();
  });

  it("preloads shared attachment bytes through the scoped shared URL", async () => {
    const fetchResource = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(new Response("preview", { status: 200 }));

    render(
      <EmailChainViewer
        entries={entries}
        manifest={manifest}
        summary={summary}
        sharedGrantId="grant-one"
      />,
    );

    await waitFor(() => {
      expect(fetchResource).toHaveBeenCalledWith(
        "/shared/grant-one/files/example-chain/attachments/example%20note.txt",
        { cache: "no-store" },
      );
    });
    expect(screen.getByRole("link", { name: "← All chains" }).getAttribute("href"))
      .toBe("/shared/grant-one");
  });

  it("preserves private attachment preloading", async () => {
    const fetchResource = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(new Response("preview", { status: 200 }));

    render(
      <EmailChainViewer
        entries={entries}
        manifest={manifest}
        summary={summary}
      />,
    );

    await waitFor(() => {
      expect(fetchResource).toHaveBeenCalledWith(
        "/api/files/example-chain/attachments/example%20note.txt",
        { cache: "no-store" },
      );
    });
  });
});
