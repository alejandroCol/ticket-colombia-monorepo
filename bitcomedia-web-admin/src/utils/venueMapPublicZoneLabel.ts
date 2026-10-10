import type { CSSProperties } from 'react';
import type { VenueMapVisualConfig } from '@services/types';
import { DEFAULT_VENUE_MAP_BACKGROUND } from '../components/VenueMapBuilder/constants';

const HEX6 = /^#[0-9A-Fa-f]{6}$/;

/** Tamaño base del label en la tienda (rem). */
export const PUBLIC_ZONE_LABEL_BASE_REM = 0.7;

export const PUBLIC_ZONE_LABEL_SCALE_MIN = 0.1;
export const PUBLIC_ZONE_LABEL_SCALE_MAX = 1;

export const PUBLIC_ZONE_LABEL_INSET_DEFAULT_PX = 4;
export const PUBLIC_ZONE_LABEL_INSET_MAX_PX = 12;
export const PUBLIC_ZONE_BORDER_WIDTH_DEFAULT_PX = 2;
export const PUBLIC_ZONE_BORDER_WIDTH_MIN_PX = 1;
export const PUBLIC_ZONE_BORDER_WIDTH_MAX_PX = 4;

export type PublicZoneCornerStyle = 'rounded' | 'square';

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

export function normalizeVenueMapLabelInsetPx(raw: unknown): number {
  const n = typeof raw === 'number' ? raw : parseFloat(String(raw ?? ''));
  if (!Number.isFinite(n)) return PUBLIC_ZONE_LABEL_INSET_DEFAULT_PX;
  return Math.min(
    PUBLIC_ZONE_LABEL_INSET_MAX_PX,
    Math.max(0, Math.round(n))
  );
}

export function normalizePublicZoneCornerStyle(raw: unknown): PublicZoneCornerStyle {
  return raw === 'square' ? 'square' : 'rounded';
}

export function normalizePublicZoneBorderColor(raw: unknown): 'transparent' | string | null {
  const t = String(raw ?? '').trim().toLowerCase();
  if (t === 'transparent') return 'transparent';
  return normalizeVenueMapLabelHex(String(raw ?? ''));
}

export function normalizePublicZoneBorderWidthPx(raw: unknown): number {
  const n = typeof raw === 'number' ? raw : parseFloat(String(raw ?? ''));
  if (!Number.isFinite(n)) return PUBLIC_ZONE_BORDER_WIDTH_DEFAULT_PX;
  return Math.min(
    PUBLIC_ZONE_BORDER_WIDTH_MAX_PX,
    Math.max(PUBLIC_ZONE_BORDER_WIDTH_MIN_PX, Math.round(n))
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
  scale?: number | null,
  insetPx?: number | null,
  options?: { circle?: boolean }
): CSSProperties {
  const style: CSSProperties = {};
  const s = normalizeVenueMapLabelScale(scale);
  const fontRem = Math.round(PUBLIC_ZONE_LABEL_BASE_REM * s * 1000) / 1000;
  style.fontSize = `${fontRem}rem`;
  style.lineHeight = 1.05;

  const inset = normalizeVenueMapLabelInsetPx(insetPx);
  if (!options?.circle) {
    style.left = inset;
    style.right = inset;
    style.bottom = inset;
  }

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

/** Borde del recuadro de localidad (esquinas cuadradas + padding interno). */
export function publicZoneFrameStyle(
  visual: Pick<
    VenueMapVisualConfig,
    'public_zone_corner_style' | 'public_zone_label_inset_px' | 'public_zone_border_width_px'
  >,
  isCircle: boolean
): CSSProperties {
  const style: CSSProperties = {};
  const borderW = normalizePublicZoneBorderWidthPx(visual.public_zone_border_width_px);
  style.borderWidth = `${borderW}px`;
  if (isCircle) return style;
  if (normalizePublicZoneCornerStyle(visual.public_zone_corner_style) === 'square') {
    style.borderRadius = 0;
  }
  const inset = normalizeVenueMapLabelInsetPx(visual.public_zone_label_inset_px);
  style.padding = `${inset}px`;
  style.boxSizing = 'border-box';
  return style;
}

/** Quita `undefined` y campos vacíos antes de escribir en Firestore. */
export function sanitizeVenueMapVisualForFirestore(
  visual: VenueMapVisualConfig
): VenueMapVisualConfig {
  const labelColor = normalizeVenueMapLabelHex(visual.public_zone_label_color);
  const labelScale = normalizeVenueMapLabelScale(visual.public_zone_label_scale);
  const labelInset = normalizeVenueMapLabelInsetPx(visual.public_zone_label_inset_px);
  const corners = normalizePublicZoneCornerStyle(visual.public_zone_corner_style);
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
  if (labelInset !== PUBLIC_ZONE_LABEL_INSET_DEFAULT_PX) {
    out.public_zone_label_inset_px = labelInset;
  }
  if (corners === 'square') out.public_zone_corner_style = 'square';
  const borderW = normalizePublicZoneBorderWidthPx(visual.public_zone_border_width_px);
  if (borderW !== PUBLIC_ZONE_BORDER_WIDTH_DEFAULT_PX) {
    out.public_zone_border_width_px = borderW;
  }
  const borderColor = normalizePublicZoneBorderColor(visual.public_zone_border_color);
  if (borderColor) out.public_zone_border_color = borderColor;
  const selectionColor = normalizeVenueMapLabelHex(visual.public_zone_selection_color);
  if (selectionColor) out.public_zone_selection_color = selectionColor;
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
    normalizeVenueMapLabelScale(visual.public_zone_label_scale) !== 1 ||
    normalizeVenueMapLabelInsetPx(visual.public_zone_label_inset_px) !==
      PUBLIC_ZONE_LABEL_INSET_DEFAULT_PX ||
    normalizePublicZoneCornerStyle(visual.public_zone_corner_style) === 'square' ||
    normalizePublicZoneBorderWidthPx(visual.public_zone_border_width_px) !==
      PUBLIC_ZONE_BORDER_WIDTH_DEFAULT_PX ||
    Boolean(normalizePublicZoneBorderColor(visual.public_zone_border_color)) ||
    Boolean(normalizeVenueMapLabelHex(visual.public_zone_selection_color))
  );
}
