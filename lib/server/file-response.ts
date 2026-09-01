import "server-only";

import type { FileHandle } from "node:fs/promises";
import path from "node:path";

import { buildContentDisposition, getMimeType, getSafeDisposition } from "./files";

function closingFileStream(handle: FileHandle): ReadableStream<Uint8Array> {
  const reader = (handle.readableWebStream() as ReadableStream<Uint8Array>).getReader();
  let closed = false;
  const close = async () => {
    if (closed) return;
    closed = true;
    await handle.close().catch(() => undefined);
  };
  return new ReadableStream<Uint8Array>({
    async pull(controller) {
      try {
        const result = await reader.read();
        if (result.done) { controller.close(); await close(); }
        else controller.enqueue(result.value);
      } catch (error) { controller.error(error); await close(); }
    },
    async cancel(reason) { await reader.cancel(reason).catch(() => undefined); await close(); },
  });
}

export async function respondWithArchiveFile(input: {
  request: Request;
  opened: { handle: FileHandle; relativePath: string; size: number };
  includeBody: boolean;
  cacheControl?: string;
  extraHeaders?: HeadersInit;
}): Promise<Response> {
  const fileName = path.basename(input.opened.relativePath);
  const mimeType = getMimeType(fileName);
  const forceDownload = new URL(input.request.url).searchParams.get("download") === "1";
  const disposition = forceDownload ? "attachment" : getSafeDisposition(mimeType);
  const headers = new Headers(input.extraHeaders);
  headers.set("Cache-Control", input.cacheControl ?? "private, no-store");
  headers.set("Content-Disposition", buildContentDisposition(disposition, fileName));
  headers.set("Content-Length", String(input.opened.size));
  headers.set("Content-Type", mimeType);
  headers.set("X-Content-Type-Options", "nosniff");
  if (!input.includeBody) {
    await input.opened.handle.close().catch(() => undefined);
    return new Response(null, { status: 200, headers });
  }
  return new Response(closingFileStream(input.opened.handle), { status: 200, headers });
}
