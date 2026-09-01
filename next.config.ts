import type { NextConfig } from "next";

const defaultAllowedDevOrigins = ["127.0.0.1"];

export function getAllowedDevOrigins(
  configuredOrigins = process.env.ARCHIVE_ALLOWED_DEV_ORIGINS,
): string[] {
  const additionalOrigins = configuredOrigins
    ?.split(",")
    .map((origin) => origin.trim())
    .filter(Boolean) ?? [];

  return [...new Set([...defaultAllowedDevOrigins, ...additionalOrigins])];
}

const nextConfig: NextConfig = {
  allowedDevOrigins: getAllowedDevOrigins(),
  async headers() {
    const sharedHeaders = [
        { key: "Cache-Control", value: "private, no-store, max-age=0, must-revalidate" },
        { key: "Referrer-Policy", value: "no-referrer" },
        { key: "X-Robots-Tag", value: "noindex, nofollow, noarchive" },
        { key: "X-Content-Type-Options", value: "nosniff" },
    ];
    const pageCsp = [{ key: "Content-Security-Policy", value: "frame-ancestors 'none'; base-uri 'none'; form-action 'self'" }];
    return [
      { source: "/shared/:path*", headers: sharedHeaders },
      { source: "/shared/:grant", headers: pageCsp },
      { source: "/shared/:grant/categories/:category", headers: pageCsp },
      { source: "/shared/:grant/chains/:chain", headers: pageCsp },
    ];
  },
};

export default nextConfig;
