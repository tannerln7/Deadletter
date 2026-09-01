export type PreviewResourceCache = {
  clear: () => void;
  load: (url: string) => Promise<Blob>;
};

type FetchResource = (url: string, init: RequestInit) => Promise<Response>;

export function createPreviewResourceCache(
  fetchResource: FetchResource = (url, init) => fetch(url, init),
  maxConcurrent = 3,
): PreviewResourceCache {
  if (!Number.isInteger(maxConcurrent) || maxConcurrent < 1) {
    throw new Error("Preview cache concurrency must be a positive integer.");
  }

  // Attachment responses are intentionally `no-store`; keep prefetched bytes only in page memory.
  const entries = new Map<string, Promise<Blob>>();
  const queue: Array<() => void> = [];
  let activeRequests = 0;

  const startNext = () => {
    while (activeRequests < maxConcurrent) {
      const start = queue.shift();
      if (!start) return;
      activeRequests += 1;
      start();
    }
  };

  const schedule = (url: string): Promise<Blob> =>
    new Promise<Blob>((resolve, reject) => {
      queue.push(() => {
        fetchResource(url, { cache: "no-store" })
          .then((response) => {
            if (!response.ok) throw new Error("Preview unavailable");
            return response.blob();
          })
          .then(resolve, reject)
          .finally(() => {
            activeRequests -= 1;
            startNext();
          });
      });
      startNext();
    });

  return {
    clear() {
      entries.clear();
    },
    load(url) {
      const existing = entries.get(url);
      if (existing) return existing;

      const pending = schedule(url);
      entries.set(url, pending);
      void pending.catch(() => {
        if (entries.get(url) === pending) entries.delete(url);
      });
      return pending;
    },
  };
}
