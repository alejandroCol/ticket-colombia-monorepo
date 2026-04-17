import React from 'react';
import { useNavigate } from 'react-router-dom';
import './index.scss';

export type EventSubNavTab = 'edit' | 'tickets' | 'stats' | 'balance' | 'reports' | 'promoters' | 'widget';

export type EventSubNavProps = {
  eventId: string;
  eventTitle: string;
  /** true si el documento está en recurring_events */
  isRecurring: boolean;
  active: EventSubNavTab;
  /** partners ocultamos gestión avanzada */
  showOrganizerExtras?: boolean;
};

/**
 * Navegación modular entre secciones de un mismo evento (edición, boletos, stats, promotores, widget).
 */
const EventSubNav: React.FC<EventSubNavProps> = ({
  eventId,
  eventTitle,
  isRecurring,
  active,
  showOrganizerExtras = true,
}) => {
  const navigate = useNavigate();
  const base = isRecurring ? `/recurring-events/${eventId}` : `/events/${eventId}`;

  const items: { id: EventSubNavTab; label: string; path: string; organizerOnly?: boolean }[] = [
    { id: 'edit', label: 'Editar', path: base },
    { id: 'tickets', label: 'Boletos', path: `/events/${eventId}/tickets` },
    { id: 'stats', label: 'Estadísticas', path: `/events/${eventId}/stats` },
    { id: 'balance', label: 'Balance', path: `/events/${eventId}/balance`, organizerOnly: true },
    { id: 'reports', label: 'Reportes', path: `/events/${eventId}/reports` },
    { id: 'promoters', label: 'Promotores', path: `${base}/promoters`, organizerOnly: true },
    { id: 'widget', label: 'Venta en web', path: `${base}/widget`, organizerOnly: true },
  ];

  return (
    <nav className="event-sub-nav" aria-label={`Secciones del evento ${eventTitle}`}>
      <div className="event-sub-nav__title-row">
        <h2 className="event-sub-nav__title">{eventTitle}</h2>
        <button type="button" className="event-sub-nav__back" onClick={() => navigate('/dashboard')}>
          ← Inicio
        </button>
      </div>
      <div className="event-sub-nav__tabs" role="tablist">
        {items.map((item) => {
          if (item.organizerOnly && !showOrganizerExtras) return null;
          const isActive = active === item.id;
          return (
            <button
              key={item.id}
              type="button"
              role="tab"
              aria-selected={isActive}
              className={`event-sub-nav__tab${isActive ? ' event-sub-nav__tab--active' : ''}`}
              onClick={() => navigate(item.path)}
            >
              {item.label}
            </button>
          );
        })}
      </div>
    </nav>
  );
};

export default EventSubNav;
