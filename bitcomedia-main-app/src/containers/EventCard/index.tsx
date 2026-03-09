import React from 'react';
import PrimaryButton from '../../components/PrimaryButton';
import './index.scss';
import { Timestamp } from 'firebase/firestore';
import type { CustomStyleProps } from '../../components/types';
import { generateCustomStyles, generateClassName } from '../../components/types';

interface EventData {
  id?: string;
  slug?: string;
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

interface EventCardProps extends CustomStyleProps {
  event: EventData;
  onReserve?: (identifier: string, isRecurring?: boolean) => void;
}

const EventCard: React.FC<EventCardProps> = ({
  event,
  onReserve,
  theme,
  style,
  cssVariables,
  className,
  grungeEffect,
  animated
}) => {
  const customStyles = generateCustomStyles(theme, cssVariables);
  const containerClassName = generateClassName('event-card', theme, className);

  const formatDate = (dateString: string) => {
    if (!dateString) return '';
    const [year, month, day] = dateString.split('-').map(Number);
    const date = new Date(year, month - 1, day);
    return date.toLocaleDateString('es-CO', {
      weekday: 'short',
      month: 'short',
      day: 'numeric'
    });
  };

  const formatTime = (timeString: string) => {
    if (!timeString) return '';
    const [hour, minute] = timeString.split(':');
    const hourNum = parseInt(hour, 10);
    const period = hourNum >= 12 ? 'PM' : 'AM';
    const hour12 = hourNum % 12 || 12;
    return `${hour12}:${minute} ${period}`;
  };

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat('es-CO', {
      style: 'currency',
      currency: 'COP',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(price);
  };

  const handleReserveClick = () => {
    if (onReserve) {
      const identifier = event.slug || event.id;
      if (identifier) {
        onReserve(identifier, event.is_recurring);
      }
    }
  };

  const metaLine = event.is_recurring
    ? event.recurrence_pattern
    : `${formatDate(event.date)} · ${formatTime(event.time)}`;
  const locationLine = `${event.venue.name}, ${event.city}`;

  return (
    <article
      className={containerClassName}
      style={{ ...customStyles, ...style }}
    >
      <div className="event-card__media" onClick={handleReserveClick}>
        <img src={event.cover_image_url} alt={event.name} loading="lazy" />
        <div className="event-card__badge event-card__badge--date">
          {metaLine}
        </div>
      </div>

      <div className="event-card__body">
        <h3 className="event-card__title">{event.name}</h3>
        <p className="event-card__meta">{locationLine}</p>

        <div className="event-card__footer">
          <span className="event-card__price">{formatPrice(event.ticket_price)}</span>
          <PrimaryButton
            onClick={handleReserveClick}
            size="small"
            theme={theme}
            grungeEffect={grungeEffect}
            animated={animated}
          >
            Ver entrada
          </PrimaryButton>
        </div>
      </div>
    </article>
  );
};

export default EventCard;
