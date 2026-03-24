import type { CSSProperties } from 'react';

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

/** Estilos inline para una zona del lienzo admin (borde discontinuo + relleno). */
export function adminZoneCanvasStyle(
  color: string | undefined,
  selected: boolean
): CSSProperties {
  const hex = color?.trim() ? normalizeHex(color.trim().startsWith('#') ? color.trim() : `#${color.trim()}`) : null;
  if (!hex) return {};
  return {
    border: `2px dashed ${hex}`,
    background: rgbaFromHex(hex, selected ? 0.24 : 0.12),
    boxShadow: selected ? `0 0 0 2px ${rgbaFromHex(hex, 0.45)}` : undefined,
  };
}

/** Estilos para la zona en la app pública (botón overlay). */
export function publicZoneButtonStyle(color: string | undefined, active: boolean): CSSProperties {
  const hex = color?.trim() ? normalizeHex(color.trim().startsWith('#') ? color.trim() : `#${color.trim()}`) : null;
  if (!hex) return {};
  return {
    borderColor: hex,
    background: rgbaFromHex(hex, active ? 0.32 : 0.12),
    boxShadow: active ? `0 0 0 2px ${rgbaFromHex(hex, 0.5)}` : undefined,
  };
}
