import React from "react";
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
  onSelectSection: (section: EventSection) => void;
}

const DEFAULT_VENUE_MAP_BG = "#1a1a28";

/**
 * Mapa con zonas rectangulares en % (0–100) sobre imagen o diseño vectorial; al hacer clic selecciona la localidad.
 *
 * Si existe configuración vectorial (`visual` con piezas o fondo), se pinta con HTML para que las etiquetas
 * (palcos, mesa, tarima, etc.) se lean bien en móvil. El PNG aplanado solo se usa cuando no hay `visual` usable
 * (mapas legacy).
 */
const VenueMapInteractive: React.FC<VenueMapInteractiveProps> = ({
  imageUrl,
  visual,
  zones,
  sections,
  selectedSectionId,
  onSelectSection,
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

  return (
    <div className="venue-map-interactive">
      <h4 className="venue-map-interactive__title">Mapa del lugar</h4>
      <p className="venue-map-interactive__hint">
        {zones.length > 0
          ? "Toca una zona del mapa para elegir localidad"
          : "Mapa orientativo. Elige tu localidad abajo."}
      </p>
      <div
        className={`venue-map-interactive__frame${showVector ? " venue-map-interactive__frame--generated" : ""}`}
      >
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
            const active = selectedSectionId === z.sectionId;
            const tint = publicZoneButtonStyle(z.color, active);
            const hasTint = Object.keys(tint).length > 0;
            return (
              <button
                key={z.id}
                type="button"
                className={`venue-map-interactive__zone${active ? " venue-map-interactive__zone--active" : ""}${hasTint ? " venue-map-interactive__zone--custom" : ""}`}
                style={{
                  left: `${z.x}%`,
                  top: `${z.y}%`,
                  width: `${z.w}%`,
                  height: `${z.h}%`,
                  ...tint,
                }}
                title={z.label || sec.name}
                aria-label={`Seleccionar ${sec.name}`}
                onClick={() => onSelectSection(sec)}
              >
                <span className="venue-map-interactive__zone-label">{z.label || sec.name}</span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default VenueMapInteractive;
