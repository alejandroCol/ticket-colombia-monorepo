import React from "react";
import type { VenueMapVisualConfig } from "../../services/types";
import "./index.scss";

export interface VenueMapVisualLayerProps {
  visual: VenueMapVisualConfig;
}

/**
 * Renderiza el mapa generado en el admin (sin imagen URL), mismas proporciones % que en el editor.
 */
const VenueMapVisualLayer: React.FC<VenueMapVisualLayerProps> = ({ visual }) => {
  const bg = visual.background || "#1a1a28";
  const sorted = [...visual.decorations].sort(
    (a, b) => (a.zIndex ?? 0) - (b.zIndex ?? 0)
  );

  const bgImg = visual.backgroundImageUrl?.trim();

  return (
    <div className="venue-map-visual-layer" style={{ background: bg }}>
      {bgImg ? (
        <img
          className="venue-map-visual-layer__bg-img"
          src={bgImg}
          alt=""
          aria-hidden
        />
      ) : null}
      {sorted.map((d) => (
        <div
          key={d.id}
          className={`venue-map-visual-layer__dec venue-map-visual-layer__dec--${d.type}`}
          style={{
            left: `${d.x}%`,
            top: `${d.y}%`,
            width: `${d.w}%`,
            height: `${d.h}%`,
            transform: `rotate(${d.rotation || 0}deg)`,
            zIndex: d.zIndex ?? 5,
          }}
        >
          <div
            className="venue-map-visual-layer__dec-inner"
            style={d.color ? { background: d.color } : undefined}
          >
            {d.label ? (
              <span className="venue-map-visual-layer__dec-label">{d.label}</span>
            ) : null}
          </div>
        </div>
      ))}
    </div>
  );
};

export default VenueMapVisualLayer;
