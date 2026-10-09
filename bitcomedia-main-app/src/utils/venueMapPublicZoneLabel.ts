import type { CSSProperties } from "react";

const HEX6 = /^#[0-9A-Fa-f]{6}$/;

export const PUBLIC_ZONE_LABEL_BASE_REM = 0.7;
export const PUBLIC_ZONE_LABEL_SCALE_MIN = 0.45;
export const PUBLIC_ZONE_LABEL_SCALE_MAX = 1;

export function normalizeVenueMapLabelHex(raw: string | undefined | null): string | null {
  const t = String(raw ?? "").trim();
  if (!HEX6.test(t)) return null;
  return t.toLowerCase();
}

export function normalizeVenueMapLabelScale(raw: unknown): number {
  const n = typeof raw === "number" ? raw : parseFloat(String(raw ?? ""));
  if (!Number.isFinite(n)) return 1;
  return Math.min(
    PUBLIC_ZONE_LABEL_SCALE_MAX,
    Math.max(PUBLIC_ZONE_LABEL_SCALE_MIN, Math.round(n * 100) / 100)
  );
}

function labelLuminance(hex: string): number {
  const n = hex.replace("#", "");
  const r = parseInt(n.slice(0, 2), 16);
  const g = parseInt(n.slice(2, 4), 16);
  const b = parseInt(n.slice(4, 6), 16);
  return 0.299 * r + 0.587 * g + 0.114 * b;
}

export function publicZoneLabelStyle(
  color?: string | null,
  scale?: number | null
): CSSProperties {
  const style: CSSProperties = {};
  const s = normalizeVenueMapLabelScale(scale);
  const fontRem = Math.round(PUBLIC_ZONE_LABEL_BASE_REM * s * 1000) / 1000;
  style.fontSize = `${fontRem}rem`;
  style.lineHeight = 1.1;

  const hex = normalizeVenueMapLabelHex(color);
  if (hex) {
    const dark = labelLuminance(hex) < 140;
    style.color = hex;
    style.textShadow = dark
      ? "0 0 1px rgba(255,255,255,0.35)"
      : "0 1px 3px rgba(0,0,0,0.85)";
  }
  return style;
}
