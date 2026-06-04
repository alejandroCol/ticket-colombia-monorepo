import React from 'react';
import './index.scss';

interface OrganizerNavPillProps {
  onClick: () => void;
  active?: boolean;
  className?: string;
  /** Variante compacta para barra inferior móvil */
  variant?: 'header' | 'bottom';
}

const OrganizerNavPill: React.FC<OrganizerNavPillProps> = ({
  onClick,
  active = false,
  className = '',
  variant = 'header',
}) => (
  <button
    type="button"
    className={`nav-organizer-pill nav-organizer-pill--${variant} ${
      active ? 'nav-organizer-pill--active' : ''
    } ${className}`.trim()}
    onClick={onClick}
    aria-current={active ? 'page' : undefined}
  >
    ¿Organizador?
  </button>
);

export default OrganizerNavPill;
