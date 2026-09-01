export function buildArchiveFileUrl(
  chainSlug: string,
  chainRelativeFile: string,
  options: { download?: boolean } = {},
): string {
  const encodedPath = chainRelativeFile
    .split("/")
    .map((segment) => encodeURIComponent(segment))
    .join("/");
  const baseUrl = `/api/files/${encodeURIComponent(chainSlug)}/${encodedPath}`;

  return options.download ? `${baseUrl}?download=1` : baseUrl;
}

export function buildSharedArchiveFileUrl(
  grantId: string,
  chainSlug: string,
  chainRelativeFile: string,
  options: { download?: boolean } = {},
): string {
  const encodedPath = chainRelativeFile
    .split("/")
    .map((segment) => encodeURIComponent(segment))
    .join("/");
  const baseUrl =
    `/shared/${encodeURIComponent(grantId)}/files/` +
    `${encodeURIComponent(chainSlug)}/${encodedPath}`;

  return options.download ? `${baseUrl}?download=1` : baseUrl;
}
