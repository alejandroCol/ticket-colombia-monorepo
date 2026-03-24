import React from 'react';
import type { VenueMapDecoration } from '@services/types';

export interface DecorationPreviewProps {
  d: VenueMapDecoration;
  selected?: boolean;
  onPointerDown: (e: React.PointerEvent, id: string) => void;
  onResizePointerDown?: (e: React.PointerEvent, id: string) => void;
}

const DecorationPreview: React.FC<DecorationPreviewProps> = ({
  d,
  selected,
  onPointerDown,
  onResizePointerDown,
}) => {
  const style: React.CSSProperties = {
    left: `${d.x}%`,
    top: `${d.y}%`,
    width: `${d.w}%`,
    height: `${d.h}%`,
    transform: `rotate(${d.rotation || 0}deg)`,
    zIndex: d.zIndex ?? 5,
    '--dec-color': d.color || undefined,
  } as React.CSSProperties;

  return (
    <div
      className={`vmb-decoration vmb-decoration--${d.type}${selected ? ' vmb-decoration--selected' : ''}`}
      style={style}
      onPointerDown={(e) => {
        e.stopPropagation();
        onPointerDown(e, d.id);
      }}
      onMouseDown={(e) => e.stopPropagation()}
      role="presentation"
    >
      <div className="vmb-decoration__inner">
        {d.label ? <span className="vmb-decoration__label">{d.label}</span> : null}
      </div>
      {selected && onResizePointerDown ? (
        <button
          type="button"
          className="vmb-decoration__resize"
          aria-label="Redimensionar"
          onPointerDown={(e) => {
            e.stopPropagation();
            onResizePointerDown(e, d.id);
          }}
          onMouseDown={(e) => e.stopPropagation()}
        />
      ) : null}
    </div>
  );
};

export default DecorationPreview;
