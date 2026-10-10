import type { CSSProperties } from 'react';
import type { VenueMapVisualConfig } from '@services/types';
import {
  normalizePublicZoneBorderColor,
  normalizeVenueMapLabelHex,
} from '../../utils/venueMapPublicZoneLabel';

function normalizeHex(input: string): string | null {
  const h = input.trim().replace(/^#/, '');
  if (h.length !== 6 || !/^[0-9a-f]+$/i.test(h)) return null;
  return `#${h.toLowerCase()}`;
}

function rgb(hex: string): [number, number, number] | null {
  const n = normalizeHex(hex);
  if (!n) return null;
  return [
    parseInt(n.slice(1, 3), 16),
    parseInt(n.slice(3, 5), 16),
    parseInt(n.slice(5, 7), 16),
  ];
}

export function rgbaFromHex(hex: string, alpha: number): string {
  const c = rgb(hex);
  if (!c) return `rgba(0, 212, 255, ${alpha})`;
  return `rgba(${c[0]}, ${c[1]}, ${c[2]}, ${alpha})`;
}

const ADMIN_SELECTION_INSET_PX = 5;

/** Estilos inline para una zona del lienzo admin (vista previa tienda). */
export function adminZoneCanvasStyle(
  color: string | undefined,
  selected: boolean,
  visual?: Pick<VenueMapVisualConfig, 'public_zone_border_color' | 'public_zone_selection_color'>
): CSSProperties {
  const zoneHex = color?.trim()
    ? normalizeHex(color.trim().startsWith('#') ? color.trim() : `#${color.trim()}`)
    : null;
  const borderCfg = normalizePublicZoneBorderColor(visual?.public_zone_border_color);
  const selectionHex = normalizeVenueMapLabelHex(visual?.public_zone_selection_color);
  const fillHex = zoneHex || '#00c8ff';

  const style: CSSProperties = {
    background: rgbaFromHex(fillHex, selected ? 0.24 : 0.12),
  };

  if (borderCfg === 'transparent') {
    style.borderColor = 'transparent';
  } else if (borderCfg) {
    style.borderColor = borderCfg;
  } else if (zoneHex) {
    style.borderColor = zoneHex;
  }

  if (selected) {
    const ring = selectionHex || zoneHex || '#ffab40';
    style.boxShadow = `inset 0 0 0 ${ADMIN_SELECTION_INSET_PX}px ${ring}, 0 0 0 2px ${rgbaFromHex(ring, 0.45)}`;
    if (borderCfg !== 'transparent' && !borderCfg && !zoneHex) {
      style.borderColor = ring;
    }
  }

  if (!zoneHex && !borderCfg && !selected) return {};
  if (!zoneHex && borderCfg === 'transparent' && !selected) {
    return { borderColor: 'transparent', background: rgbaFromHex(fillHex, 0.12) };
  }
  if (!zoneHex && !borderCfg && !selectionHex && !selected) return {};

  return style;
}
