import React, { useState } from "react";
import type { EventSection, VenueMapVisualConfig, VenueMapZone } from "../../services/types";
import { publicZoneButtonStyle } from "../../utils/venueMapZoneStyle";
import VenueMapVisualLayer from "../VenueMapVisualLayer";
import "./index.scss";

export interface VenueMapInteractiveProps {
  /** PNG aplanado (`flatRenderUrl`) o mapa legacy (`venue_map_url`). Tiene prioridad sobre el lienzo vectorial. */
  imageUrl?: string;
  /** Mapa dibujado en el admin (sin URL). */
  visual?: VenueMapVisualConfig;
  zones: VenueMapZone[];
  sections: EventSection[];
  selectedSectionId?: string;
  /** id de zona de mapa cuando la localidad tiene palcos divididos */
  selectedMapZoneId?: string | null;
  /** Ocupación por id de zona (tickets + reservas). */
  mapZoneSold?: Record<string, number>;
  onSelectZoneOnMap: (section: EventSection, zone: VenueMapZone) => void;
}

const DEFAULT_VENUE_MAP_BG = "#1a1a28";

/**
 * Mapa con zonas rectangulares en % (0–100) sobre imagen o diseño vectorial; al hacer clic se elige localidad y palco.
 */
const VenueMapInteractive: React.FC<VenueMapInteractiveProps> = ({
  imageUrl,
  visual,
  zones,
  sections,
  selectedSectionId,
  selectedMapZoneId = null,
  mapZoneSold = {},
  onSelectZoneOnMap,
}) => {
  const resolveSection = (sectionId: string) =>
    sections.find((s) => s.id === sectionId);

  const visualCanRender = Boolean(
    visual &&
      ((visual.decorations?.length ?? 0) > 0 ||
        Boolean(visual.backgroundImageUrl?.trim()) ||
        Boolean(
          visual.background &&
            visual.background.toLowerCase() !== DEFAULT_VENUE_MAP_BG
        ))
  );

  const showRasterOnly = Boolean(imageUrl) && !visualCanRender;
  const showVector = visualCanRender && Boolean(visual);

  const [hoveredZoneId, setHoveredZoneId] = useState<string | null>(null);

  const isPortrait = visual?.frame_aspect === "portrait";
  const hidePublicZoneLabels = visual?.hide_public_zone_labels === true;

  const frameClass = [
    "venue-map-interactive__frame",
    showVector ? "venue-map-interactive__frame--generated" : "",
    isPortrait ? "venue-map-interactive__frame--portrait" : "",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <div className="venue-map-interactive">
      <h4 className="venue-map-interactive__title">Mapa del lugar</h4>
      <p className="venue-map-interactive__hint">
        {zones.length > 0
          ? "Toca una zona del mapa para elegir localidad (y palco si aplica)"
          : "Mapa orientativo. Elige tu localidad abajo."}
      </p>
      <div className={frameClass}>
        {showRasterOnly && imageUrl ? (
          <img src={imageUrl} alt="Mapa de localidades" className="venue-map-interactive__img" />
        ) : showVector ? (
          <div className="venue-map-interactive__generated">
            <VenueMapVisualLayer visual={visual!} />
          </div>
        ) : null}
        <div className="venue-map-interactive__overlay">
          {zones.map((z) => {
            const sec = resolveSection(z.sectionId);
            if (!sec) return null;
            const isPalcoCell = z.palco_index != null;
            const soldOut = (mapZoneSold[z.id] ?? 0) >= 1;
            const zoneSelected = selectedMapZoneId === z.id;
            const sectionSelected = selectedSectionId === z.sectionId;
            const active = isPalcoCell ? zoneSelected : sectionSelected;
            const hovered = hoveredZoneId === z.id;
            const tint = publicZoneButtonStyle(z.color, active, hovered);
            const hasTint = Object.keys(tint).length > 0;
            const labelText = isPalcoCell ? z.label : z.label || sec.name;
            const aria = isPalcoCell
              ? `${sec.name}, palco ${z.label}${soldOut ? ", no disponible" : ""}`
              : `Seleccionar ${sec.name}`;
            return (
              <button
                key={z.id}
                type="button"
                disabled={soldOut}
                className={`venue-map-interactive__zone${
                  z.shape === "circle" ? " venue-map-interactive__zone--circle" : ""
                }${soldOut ? " venue-map-interactive__zone--soldout" : ""}${
                  active ? " venue-map-interactive__zone--active" : ""
                }${hasTint ? " venue-map-interactive__zone--custom" : ""}`}
                style={{
                  left: `${z.x}%`,
                  top: `${z.y}%`,
                  width: `${z.w}%`,
                  height: `${z.h}%`,
                  ...tint,
                }}
                title={isPalcoCell ? `${sec.name} · ${z.label}` : z.label || sec.name}
                aria-label={aria}
                onMouseEnter={() => setHoveredZoneId(z.id)}
                onMouseLeave={(e) => {
                  if (e.currentTarget !== document.activeElement) {
                    setHoveredZoneId(null);
                  }
                }}
                onFocus={() => setHoveredZoneId(z.id)}
                onBlur={() => setHoveredZoneId(null)}
                onClick={() => {
                  if (!soldOut) onSelectZoneOnMap(sec, z);
                }}
              >
                {!hidePublicZoneLabels ? (
                  <span className="venue-map-interactive__zone-label">
                    {soldOut ? "—" : labelText}
                  </span>
                ) : null}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default VenueMapInteractive;
