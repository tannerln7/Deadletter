import { resolveArchiveRoot } from "@/lib/server/archive-root";
import { loadEmails } from "@/lib/server/emails";
import { respondWithArchiveFile } from "@/lib/server/file-response";
import { openSafeArchiveFile, PathSafetyError } from "@/lib/server/path-safety";
import type { OpenArchiveFile } from "@/lib/server/path-safety";
import { requireShareAccess, sharedFileResponseHeaders } from "@/lib/server/shares/access";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function serve(request: Request, context: { params: Promise<{ grant: string; chain: string; path: string[] }> }, includeBody: boolean) {
  let opened: OpenArchiveFile | undefined;
  try {
    const { grant, chain, path } = await context.params;
    await requireShareAccess({ grantId: grant, chainSlug: chain, headers: request.headers });
    const candidate = await openSafeArchiveFile(resolveArchiveRoot(), chain, path);
    opened = candidate;
    const entries = await loadEmails(chain);
    if (!entries.some((entry) => entry.attachments.some((attachment) => attachment.file === candidate.relativePath))) {
      await candidate.handle.close();
      throw new Error("not referenced");
    }
  } catch (error) {
    if (opened) await opened.handle.close().catch(() => undefined);
    const status = error instanceof PathSafetyError && error.code === "invalid-path" ? 400 : 404;
    return new Response(status === 400 ? "Invalid file path." : "Shared file not found.", { status, headers: sharedFileResponseHeaders });
  }
  return respondWithArchiveFile({ request, opened, includeBody, cacheControl: sharedFileResponseHeaders["Cache-Control"], extraHeaders: sharedFileResponseHeaders });
}

export async function GET(request: Request, context: { params: Promise<{ grant: string; chain: string; path: string[] }> }) { return serve(request, context, true); }
export async function HEAD(request: Request, context: { params: Promise<{ grant: string; chain: string; path: string[] }> }) { return serve(request, context, false); }
