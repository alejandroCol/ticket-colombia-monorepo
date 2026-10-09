import type { CSSProperties } from 'react';
import type { VenueMapVisualConfig } from '@services/types';
import { DEFAULT_VENUE_MAP_BACKGROUND } from '../components/VenueMapBuilder/constants';

const HEX6 = /^#[0-9A-Fa-f]{6}$/;

export function normalizeVenueMapLabelHex(raw: string | undefined | null): string | null {
  const t = String(raw ?? '').trim();
  if (!HEX6.test(t)) return null;
  return t.toLowerCase();
}

function labelLuminance(hex: string): number {
  const n = hex.replace('#', '');
  const r = parseInt(n.slice(0, 2), 16);
  const g = parseInt(n.slice(2, 4), 16);
  const b = parseInt(n.slice(4, 6), 16);
  return 0.299 * r + 0.587 * g + 0.114 * b;
}

/** Estilo inline para etiquetas de localidad (admin y tienda). Sin color = CSS por defecto (blanco). */
export function publicZoneLabelStyle(color?: string | null): CSSProperties {
  const hex = normalizeVenueMapLabelHex(color);
  if (!hex) return {};
  const dark = labelLuminance(hex) < 140;
  return {
    color: hex,
    textShadow: dark
      ? '0 0 1px rgba(255,255,255,0.35)'
      : '0 1px 3px rgba(0,0,0,0.85)',
  };
}

/** Quita `undefined` y campos vacíos antes de escribir en Firestore. */
export function sanitizeVenueMapVisualForFirestore(
  visual: VenueMapVisualConfig
): VenueMapVisualConfig {
  const labelColor = normalizeVenueMapLabelHex(visual.public_zone_label_color);
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
    Boolean(v.public_zone_label_color)
  );
}
