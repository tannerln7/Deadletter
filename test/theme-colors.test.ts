import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

const stylesheet = readFileSync(new URL("../app/globals.css", import.meta.url), "utf8");

function themeColors(selector: string): Record<string, string> {
  const block = stylesheet.slice(stylesheet.indexOf(selector)).split("}", 1)[0];
  return Object.fromEntries(
    [...block.matchAll(/--([\w-]+):\s*(#[\da-f]{6});/gi)].map((match) => [match[1], match[2]]),
  );
}

function luminance(hex: string): number {
  const channels = hex.slice(1).match(/../g)!.map((channel) => {
    const value = Number.parseInt(channel, 16) / 255;
    return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * channels[0] + 0.7152 * channels[1] + 0.0722 * channels[2];
}

function contrast(first: string, second: string): number {
  const values = [luminance(first), luminance(second)].sort((a, b) => b - a);
  return (values[0] + 0.05) / (values[1] + 0.05);
}

describe.each([
  ["light", ":root {"],
  ["dark", ':root[data-theme="dark"] {'],
])("%s theme", (_name, selector) => {
  const colors = themeColors(selector);

  it("keeps normal text and brand links readable on their surfaces", () => {
    for (const foreground of ["ink", "body-ink", "muted", "accent-strong", "accent-hover"]) {
      for (const background of ["background", "surface", "surface-subtle", "accent-soft"]) {
        expect(contrast(colors[foreground], colors[background]), `${foreground} on ${background}`).toBeGreaterThanOrEqual(4.5);
      }
    }
  });

  it("keeps primary, hovered, and selected controls readable", () => {
    for (const background of ["accent", "accent-hover"]) {
      expect(contrast(colors["on-accent"], colors[background]), `on-accent on ${background}`).toBeGreaterThanOrEqual(4.5);
    }
    expect(contrast(colors["control-active-ink"], colors["control-active"])).toBeGreaterThanOrEqual(4.5);
  });

  it("uses distinct, readable warning and error colors", () => {
    for (const status of ["warning", "danger"]) {
      expect(colors[status]).not.toBe(colors.accent);
      expect(contrast(colors[status], colors[`${status}-soft`])).toBeGreaterThanOrEqual(4.5);
      expect(contrast(colors.muted, colors[`${status}-soft`])).toBeGreaterThanOrEqual(4.5);
      expect(contrast(colors[status], colors.surface)).toBeGreaterThanOrEqual(4.5);
    }
  });
});
