import React from 'react';
import PrimaryButton from '@components/PrimaryButton';
import SecondaryButton from '@components/SecondaryButton';
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

interface EventCardProps {
  event: EventData;
  onReserve?: (eventId: string, isRecurring?: boolean) => void;
  onCreateTicket?: (eventId: string, eventName: string, eventPrice: number) => void;
  onViewTickets?: (eventId: string, eventName: string) => void;
}

const EventCard: React.FC<EventCardProps> = ({ event, onReserve, onCreateTicket, onViewTickets }) => {
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
  const handleReserveClick = () => {
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

  return (
    <div className={`event-card ${event.status === 'inactive' ? 'inactive' : ''}`}>
      <div className="event-card-image">
        <img src={event.cover_image_url} alt={event.name} />
        {event.status === 'inactive' && (
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
              <span className="event-card-recurrence">{event.recurrence_pattern}</span>
            ) : (
              <>
                <span className="event-card-date">{formatDate(event.date)}</span>
                <span className="event-card-time">{formatTime(event.time)}</span>
              </>
            )}
          </div>
          
          <div className="event-card-location">
            <div className="event-card-venue">{event.venue.name}</div>
            <div className="event-card-city">{event.city}</div>
          </div>
        </div>
        
        <p className="event-card-description">{event.description}</p>
        
        <div className="event-card-footer">
          <div className="event-card-price">{formatPrice(event.ticket_price)}</div>
          <div className="event-card-actions">
            <SecondaryButton onClick={handleCreateTicketClick} size="small">
              🎫 Crear
            </SecondaryButton>
            <SecondaryButton onClick={handleViewTicketsClick} size="small">
              👁️ Ver Boletos
            </SecondaryButton>
            <PrimaryButton onClick={handleReserveClick} size="small">
              ✏️ Editar
            </PrimaryButton>
          </div>
        </div>
      </div>
    </div>
  );
};

export default EventCard; 