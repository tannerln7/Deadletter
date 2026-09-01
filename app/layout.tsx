import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { headers } from "next/headers";

import SiteHeader from "@/components/SiteHeader";
import { loadSecurityConfig, requestHost } from "@/lib/server/security/config";

import "./globals.css";

const themeInitializationScript = `
(function () {
  try {
    var storedTheme = localStorage.getItem("deadletter-theme");
    var theme = storedTheme === "light" || storedTheme === "dark"
      ? storedTheme
      : window.matchMedia("(prefers-color-scheme: dark)").matches
        ? "dark"
        : "light";
    document.documentElement.setAttribute("data-theme", theme);
  } catch {}
})();`;

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: {
    default: "Deadletter",
    template: "%s · Deadletter",
  },
  description: "Turn scattered email threads and attachments into structured, browsable, shareable archives.",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  let isShareHost = false;
  try {
    isShareHost = requestHost(new Headers(await headers())) === loadSecurityConfig().shareOrigin.host;
  } catch {}

  return (
    <html
      lang="en"
      data-theme="light"
      suppressHydrationWarning
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeInitializationScript }} />
      </head>
      <body className="min-h-full">
        {isShareHost ? null : <SiteHeader />}
        {children}
      </body>
    </html>
  );
}
