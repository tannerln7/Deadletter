import { describe, expect, it, vi } from "vitest";

import { createPreviewResourceCache } from "@/lib/preview-cache";

function response(body: string): Response {
  return new Response(body, { status: 200 });
}

describe("preview resource cache", () => {
  it("deduplicates repeated loads for the same attachment", async () => {
    const fetchResource = vi.fn(async () => response("preview"));
    const cache = createPreviewResourceCache(fetchResource);

    const first = cache.load("/api/files/example/attachments/file.txt");
    const second = cache.load("/api/files/example/attachments/file.txt");

    expect(second).toBe(first);
    await expect(first.then((blob) => blob.text())).resolves.toBe("preview");
    expect(fetchResource).toHaveBeenCalledTimes(1);
    expect(fetchResource).toHaveBeenCalledWith(
      "/api/files/example/attachments/file.txt",
      { cache: "no-store" },
    );
  });

  it("limits concurrent attachment requests", async () => {
    let active = 0;
    let peak = 0;
    const releases: Array<() => void> = [];
    const fetchResource = vi.fn(
      () =>
        new Promise<Response>((resolve) => {
          active += 1;
          peak = Math.max(peak, active);
          releases.push(() => {
            active -= 1;
            resolve(response("preview"));
          });
        }),
    );
    const cache = createPreviewResourceCache(fetchResource, 2);

    const loads = ["one", "two", "three"].map((url) => cache.load(url));
    expect(fetchResource).toHaveBeenCalledTimes(2);
    expect(peak).toBe(2);

    releases.shift()?.();
    await vi.waitFor(() => expect(fetchResource).toHaveBeenCalledTimes(3));
    expect(peak).toBe(2);

    for (const release of releases) release();
    await Promise.all(loads);
  });

  it("removes failed loads so a later preview can retry", async () => {
    const fetchResource = vi
      .fn<() => Promise<Response>>()
      .mockResolvedValueOnce(new Response(null, { status: 404 }))
      .mockResolvedValueOnce(response("available"));
    const cache = createPreviewResourceCache(fetchResource);

    await expect(cache.load("missing")).rejects.toThrow("Preview unavailable");
    await expect(cache.load("missing").then((blob) => blob.text())).resolves.toBe("available");
    expect(fetchResource).toHaveBeenCalledTimes(2);
  });
});
