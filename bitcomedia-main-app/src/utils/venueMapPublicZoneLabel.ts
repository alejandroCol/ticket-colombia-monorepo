import type { CSSProperties } from "react";

const HEX6 = /^#[0-9A-Fa-f]{6}$/;

export function normalizeVenueMapLabelHex(raw: string | undefined | null): string | null {
  const t = String(raw ?? "").trim();
  if (!HEX6.test(t)) return null;
  return t.toLowerCase();
}

function labelLuminance(hex: string): number {
  const n = hex.replace("#", "");
  const r = parseInt(n.slice(0, 2), 16);
  const g = parseInt(n.slice(2, 4), 16);
  const b = parseInt(n.slice(4, 6), 16);
  return 0.299 * r + 0.587 * g + 0.114 * b;
}

export function publicZoneLabelStyle(color?: string | null): CSSProperties {
  const hex = normalizeVenueMapLabelHex(color);
  if (!hex) return {};
  const dark = labelLuminance(hex) < 140;
  return {
    color: hex,
    textShadow: dark
      ? "0 0 1px rgba(255,255,255,0.35)"
      : "0 1px 3px rgba(0,0,0,0.85)",
  };
}
