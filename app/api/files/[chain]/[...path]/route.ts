import { resolveArchiveRoot } from "@/lib/server/archive-root";
import { respondWithArchiveFile } from "@/lib/server/file-response";
import { openSafeArchiveFile, PathSafetyError } from "@/lib/server/path-safety";
import { PrivateAccessError, requirePrivateAccess } from "@/lib/server/security/private-access";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type FileRouteContext = {
  params: Promise<{ chain: string; path: string[] }>;
};

function errorResponse(status: 400 | 403 | 404): Response {
  const message =
    status === 400
      ? "Invalid archive path."
      : status === 403
        ? "Archive file access is not allowed."
        : "Archive file not found.";
  return Response.json(
    { error: message },
    { status, headers: { "Cache-Control": "private, no-store" } },
  );
}

function statusForPathError(error: PathSafetyError): 400 | 403 | 404 {
  if (error.code === "symlink-escape") return 403;
  if (error.code === "not-found" || error.code === "not-file") return 404;
  return 400;
}

async function serveFile(
  request: Request,
  context: FileRouteContext,
  includeBody: boolean,
): Promise<Response> {
  try {
    await requirePrivateAccess(request.headers);
  } catch (error) {
    if (error instanceof PrivateAccessError) return errorResponse(404);
    return errorResponse(404);
  }
  let opened;
  try {
    const { chain, path: rawPath } = await context.params;
    opened = await openSafeArchiveFile(resolveArchiveRoot(), chain, rawPath);
  } catch (error) {
    if (error instanceof PathSafetyError) return errorResponse(statusForPathError(error));
    return errorResponse(404);
  }

  return respondWithArchiveFile({ request, opened, includeBody });
}

export async function GET(_request: Request, context: FileRouteContext): Promise<Response> {
  return serveFile(_request, context, true);
}

export async function HEAD(_request: Request, context: FileRouteContext): Promise<Response> {
  return serveFile(_request, context, false);
}
