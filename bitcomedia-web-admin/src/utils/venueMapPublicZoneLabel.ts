import type { CSSProperties } from 'react';
import type { VenueMapVisualConfig } from '@services/types';
import { DEFAULT_VENUE_MAP_BACKGROUND } from '../components/VenueMapBuilder/constants';

const HEX6 = /^#[0-9A-Fa-f]{6}$/;

/** Tamaño base del label en la tienda (rem). */
export const PUBLIC_ZONE_LABEL_BASE_REM = 0.7;

export const PUBLIC_ZONE_LABEL_SCALE_MIN = 0.45;
export const PUBLIC_ZONE_LABEL_SCALE_MAX = 1;

export function normalizeVenueMapLabelHex(raw: string | undefined | null): string | null {
  const t = String(raw ?? '').trim();
  if (!HEX6.test(t)) return null;
  return t.toLowerCase();
}

export function normalizeVenueMapLabelScale(raw: unknown): number {
  const n = typeof raw === 'number' ? raw : parseFloat(String(raw ?? ''));
  if (!Number.isFinite(n)) return 1;
  return Math.min(
    PUBLIC_ZONE_LABEL_SCALE_MAX,
    Math.max(PUBLIC_ZONE_LABEL_SCALE_MIN, Math.round(n * 100) / 100)
  );
}

function labelLuminance(hex: string): number {
  const n = hex.replace('#', '');
  const r = parseInt(n.slice(0, 2), 16);
  const g = parseInt(n.slice(2, 4), 16);
  const b = parseInt(n.slice(4, 6), 16);
  return 0.299 * r + 0.587 * g + 0.114 * b;
}

/** Estilo inline para etiquetas de localidad (admin y tienda). */
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
      ? '0 0 1px rgba(255,255,255,0.35)'
      : '0 1px 3px rgba(0,0,0,0.85)';
  }
  return style;
}

/** Quita `undefined` y campos vacíos antes de escribir en Firestore. */
export function sanitizeVenueMapVisualForFirestore(
  visual: VenueMapVisualConfig
): VenueMapVisualConfig {
  const labelColor = normalizeVenueMapLabelHex(visual.public_zone_label_color);
  const labelScale = normalizeVenueMapLabelScale(visual.public_zone_label_scale);
  const out: VenueMapVisualConfig = {
    background: visual.background || DEFAULT_VENUE_MAP_BACKGROUND,
    decorations: Array.isArray(visual.decorations) ? visual.decorations : [],
  };
  const bgImg = visual.backgroundImageUrl?.trim();
  if (bgImg) out.backgroundImageUrl = bgImg;
  const flat = visual.flatRenderUrl?.trim();
  if (flat) out.flatRenderUrl = flat;
  if (visual.frame_aspect === 'portrait') out.frame_aspect = 'portrait';
  if (visual.hide_public_zone_labels === true) out.hide_public_zone_labels = true;
  if (labelColor) out.public_zone_label_color = labelColor;
  if (labelScale !== 1) out.public_zone_label_scale = labelScale;
  return out;
}

export function venueMapVisualHasPersistedOptions(visual: VenueMapVisualConfig): boolean {
  const v = sanitizeVenueMapVisualForFirestore(visual);
  return (
    v.decorations.length > 0 ||
    v.background !== DEFAULT_VENUE_MAP_BACKGROUND ||
    Boolean(v.backgroundImageUrl?.trim()) ||
    Boolean(v.flatRenderUrl?.trim()) ||
    v.frame_aspect === 'portrait' ||
    v.hide_public_zone_labels === true ||
    Boolean(v.public_zone_label_color) ||
    normalizeVenueMapLabelScale(visual.public_zone_label_scale) !== 1
  );
}
