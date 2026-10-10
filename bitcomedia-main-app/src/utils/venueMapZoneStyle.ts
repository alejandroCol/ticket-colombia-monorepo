import type { CSSProperties } from "react";
import type { VenueMapVisualConfig } from "../services/types";
import {
  normalizePublicZoneBorderColor,
  normalizeVenueMapLabelHex,
} from "./venueMapPublicZoneLabel";

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

const ZONE_ACTIVE_INSET_PX = 7;
const ZONE_HOVER_INSET_PX = 4;

function resolveBorderColor(
  borderCfg: ReturnType<typeof normalizePublicZoneBorderColor>,
  zoneHex: string | null,
  fallbackHex: string | null
): string | undefined {
  if (borderCfg === "transparent") return "transparent";
  if (borderCfg) return borderCfg;
  if (zoneHex) return zoneHex;
  return fallbackHex ?? undefined;
}

/** Estilos del botón-zona en el mapa público (color por zona + opciones visuales del evento). */
export function publicZoneOverlayStyle(
  visual: Pick<VenueMapVisualConfig, "public_zone_border_color" | "public_zone_selection_color"> | undefined,
  zoneColor: string | undefined,
  active: boolean,
  hovered: boolean
): CSSProperties {
  const zoneHex = zoneColor?.trim()
    ? normalizeHex(zoneColor.trim().startsWith("#") ? zoneColor.trim() : `#${zoneColor.trim()}`)
    : null;
  const borderCfg = normalizePublicZoneBorderColor(visual?.public_zone_border_color);
  const selectionHex = normalizeVenueMapLabelHex(visual?.public_zone_selection_color);
  const ringHex = selectionHex || zoneHex;

  const style: CSSProperties = {};
  let hasStyle = false;

  const idleBorder = resolveBorderColor(borderCfg, zoneHex, null);
  if (idleBorder) {
    style.borderColor = idleBorder;
    hasStyle = true;
  }

  if (zoneHex) {
    if (active && ringHex) {
      style.borderColor = resolveBorderColor(borderCfg, zoneHex, ringHex);
      style.background = rgbaFromHex(zoneHex, 0.12);
      style.boxShadow = `inset 0 0 0 ${ZONE_ACTIVE_INSET_PX}px ${ringHex}, 0 0 0 2px ${rgbaFromHex(ringHex, 0.5)}`;
      return style;
    }
    if (hovered) {
      style.borderColor = resolveBorderColor(borderCfg, zoneHex, zoneHex);
      style.background = rgbaFromHex(zoneHex, 0.18);
      style.boxShadow = `inset 0 0 0 ${ZONE_HOVER_INSET_PX}px ${rgbaFromHex(zoneHex, 0.85)}`;
      return style;
    }
    style.background = rgbaFromHex(zoneHex, 0.12);
    return style;
  }

  if (active && selectionHex) {
    style.borderColor = borderCfg === "transparent" ? "transparent" : selectionHex;
    style.background = rgbaFromHex(selectionHex, 0.12);
    style.boxShadow = `inset 0 0 0 ${ZONE_ACTIVE_INSET_PX}px ${selectionHex}, 0 0 0 2px ${rgbaFromHex(selectionHex, 0.45)}`;
    return style;
  }

  if (hovered && selectionHex) {
    style.borderColor = borderCfg === "transparent" ? "transparent" : selectionHex;
    style.background = rgbaFromHex(selectionHex, 0.16);
    style.boxShadow = `inset 0 0 0 ${ZONE_HOVER_INSET_PX}px ${rgbaFromHex(selectionHex, 0.75)}`;
    return style;
  }

  if (borderCfg === "transparent" && !active && !hovered) {
    style.borderColor = "transparent";
    hasStyle = true;
  } else if (borderCfg && borderCfg !== "transparent" && !active && !hovered) {
    style.borderColor = borderCfg;
    hasStyle = true;
  }

  return hasStyle ? style : {};
}

/** @deprecated Use publicZoneOverlayStyle */
export function publicZoneButtonStyle(
  color: string | undefined,
  active: boolean,
  hovered: boolean
): CSSProperties {
  return publicZoneOverlayStyle(undefined, color, active, hovered);
}
