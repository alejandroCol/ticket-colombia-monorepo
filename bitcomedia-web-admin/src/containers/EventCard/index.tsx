import React from 'react';
import PrimaryButton from '@components/PrimaryButton';
import SecondaryButton from '@components/SecondaryButton';
import { IconCreate, IconViewTickets, IconStats, IconEdit } from '@components/EventCardIcons';
import './index.scss';
import { Timestamp } from 'firebase/firestore';

interface EventData {
  id?: string;
  name: string;
  description: string;
  city: string;
  venue: {
    name: string;
    address: string;
  };
  cover_image_url: string;
  date: string;
  time: string;
  event_date: Timestamp;
  ticket_price: number;
  status?: string;
  recurrence_pattern?: string;
  is_recurring?: boolean;
}

/** Si se pasa, solo se muestran acciones permitidas (usuarios partner). Omitir = todas. */
export type EventCardActionMask = {
  canEdit: boolean;
  canCreateTickets: boolean;
  canViewTickets: boolean;
  canViewStats: boolean;
};

interface EventCardProps {
  event: EventData;
  onReserve?: (eventId: string, isRecurring?: boolean) => void;
  onCreateTicket?: (eventId: string, eventName: string, eventPrice: number) => void;
  onViewTickets?: (eventId: string, eventName: string) => void;
  onViewStats?: (eventId: string) => void;
  actionMask?: EventCardActionMask;
}

const EventCard: React.FC<EventCardProps> = ({ event, onReserve, onCreateTicket, onViewTickets, onViewStats, actionMask }) => {
  const canEdit = actionMask?.canEdit !== false;
  const canCreateTickets = actionMask?.canCreateTickets !== false;
  const canViewTickets = actionMask?.canViewTickets !== false;
  const canViewStats = actionMask?.canViewStats !== false;
  const showTapStats = canViewStats && !!onViewStats;
  // Format date to a readable format
  const formatDate = (dateString: string) => {
    if (!dateString) return '';
    
    // Parse the date string manually to avoid timezone issues
    const [year, month, day] = dateString.split('-').map(Number);
    const date = new Date(year, month - 1, day); // month is 0-indexed
    
    return date.toLocaleDateString('es-CO', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  // Format time from 24h to 12h format
  const formatTime = (timeString: string) => {
    if (!timeString) return '';
    
    const [hour, minute] = timeString.split(':');
    const hourNum = parseInt(hour, 10);
    const period = hourNum >= 12 ? 'PM' : 'AM';
    const hour12 = hourNum % 12 || 12;
    
    return `${hour12}:${minute} ${period}`;
  };

  // Format price with peso symbol
  const formatPrice = (price: number) => {
    return new Intl.NumberFormat('es-CO', {
      style: 'currency',
      currency: 'COP',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(price);
  };

  // Handle reserve button click
  const handleReserveClick = (e: React.MouseEvent<HTMLButtonElement>) => {
    e.stopPropagation();
    if (onReserve && event.id) {
      onReserve(event.id, event.is_recurring);
    }
  };

  // Handle create ticket button click
  const handleCreateTicketClick = (e: React.MouseEvent) => {
    e.stopPropagation(); // Prevent event card click
    if (onCreateTicket && event.id) {
      onCreateTicket(event.id, event.name, event.ticket_price);
    }
  };

  // Handle view tickets button click
  const handleViewTicketsClick = (e: React.MouseEvent) => {
    e.stopPropagation(); // Prevent event card click
    if (onViewTickets && event.id) {
      onViewTickets(event.id, event.name);
    }
  };

  // Handle view stats button click
  const handleViewStatsClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (onViewStats && event.id) {
      onViewStats(event.id);
    }
  };

  const goToStats = () => {
    if (canViewStats && onViewStats && event.id) {
      onViewStats(event.id);
    }
  };

  const handleTapTargetKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.key !== "Enter" && e.key !== " ") return;
    e.preventDefault();
    goToStats();
  };

  return (
    <div className={`event-card ${event.status === 'inactive' ? 'inactive' : ''}`}>
      <div
        className={`event-card__tap-target ${showTapStats && event.id ? "event-card__tap-target--active" : ""}`}
        onClick={showTapStats && event.id ? goToStats : undefined}
        onKeyDown={showTapStats && event.id ? handleTapTargetKeyDown : undefined}
        role={showTapStats && event.id ? "button" : undefined}
        tabIndex={showTapStats && event.id ? 0 : undefined}
        aria-label={
          showTapStats && event.id
            ? `Ver estadísticas de ${event.name}`
            : undefined
        }
      >
        <div className="event-card-image">
          <img src={event.cover_image_url} alt="" />
          {event.status === "inactive" && (
            <div className="inactive-overlay">
              <span className="inactive-label">INACTIVO</span>
            </div>
          )}
        </div>

        <div className="event-card-content">
          <h3 className="event-card-title">{event.name}</h3>

          <div className="event-card-details">
            <div className="event-card-date-time">
              {event.is_recurring ? (
                <span className="event-card-recurrence">
                  {event.recurrence_pattern}
                </span>
              ) : (
                <>
                  <span className="event-card-date">{formatDate(event.date)}</span>
                  <span className="event-card-time">{formatTime(event.time)}</span>
                </>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="event-card-footer">
        <div className="event-card-price">{formatPrice(event.ticket_price)}</div>
        <div className="event-card-actions">
          {canCreateTickets && (
            <SecondaryButton
              onClick={handleCreateTicketClick}
              size="small"
              icon={<IconCreate size={16} />}
            >
              Crear
            </SecondaryButton>
          )}
          {canViewTickets && (
            <SecondaryButton
              onClick={handleViewTicketsClick}
              size="small"
              icon={<IconViewTickets size={16} />}
            >
              Ver Boletos
            </SecondaryButton>
          )}
          {canViewStats && (
            <SecondaryButton
              onClick={handleViewStatsClick}
              size="small"
              icon={<IconStats size={16} />}
            >
              Estadísticas
            </SecondaryButton>
          )}
          {canEdit && (
            <PrimaryButton
              onClick={handleReserveClick}
              size="small"
              icon={<IconEdit size={16} />}
            >
              Editar
            </PrimaryButton>
          )}
        </div>
      </div>
    </div>
  );
};

export default EventCard; 