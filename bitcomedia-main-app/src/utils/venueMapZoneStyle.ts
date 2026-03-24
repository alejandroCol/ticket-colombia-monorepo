import type { CSSProperties } from "react";

function normalizeHex(input: string): string | null {
  const h = input.trim().replace(/^#/, "");
  if (h.length !== 6 || !/^[0-9a-f]+$/i.test(h)) return null;
  return `#${h.toLowerCase()}`;
}

function rgb(hex: string): [number, number, number] | null {
  const n = normalizeHex(hex.startsWith("#") ? hex : `#${hex}`);
  if (!n) return null;
  return [
    parseInt(n.slice(1, 3), 16),
    parseInt(n.slice(3, 5), 16),
    parseInt(n.slice(5, 7), 16),
  ];
}

function rgbaFromHex(hex: string, alpha: number): string {
  const c = rgb(hex);
  if (!c) return `rgba(0, 212, 255, ${alpha})`;
  return `rgba(${c[0]}, ${c[1]}, ${c[2]}, ${alpha})`;
}

/** Estilos del botón-zona en el mapa público cuando hay color guardado. */
export function publicZoneButtonStyle(
  color: string | undefined,
  active: boolean
): CSSProperties {
  const raw = color?.trim();
  if (!raw) return {};
  const hex = normalizeHex(raw.startsWith("#") ? raw : `#${raw}`);
  if (!hex) return {};
  return {
    borderColor: hex,
    background: rgbaFromHex(hex, active ? 0.32 : 0.12),
    boxShadow: active ? `0 0 0 2px ${rgbaFromHex(hex, 0.5)}` : undefined,
  };
}
