import React, { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { getEventBySlug, metaPixel } from '../../services';
import type { Event } from '../../services/types';
import Chip from '../../components/Chip';
import CustomInput from '../../components/CustomInput';
import PrimaryButton from '../../components/PrimaryButton';
import SecondaryButton from '../../components/SecondaryButton';
import TopNavBar from '../../containers/TopNavBar';
import Loader from '../../components/Loader';
import './index.scss';

const EventDetailScreen: React.FC = () => {
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [event, setEvent] = useState<Event | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [ticketQuantity, setTicketQuantity] = useState<number>(1);
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();
  
  // Efecto para hacer scroll al top cuando el componente se monta
  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);
  
  useEffect(() => {
    const fetchEventData = async () => {
      try {
        setIsLoading(true);
        
        if (!slug) {
          setError('Slug del evento no proporcionado');
          setIsLoading(false);
          return;
        }
        
        // Fetch event data from Firestore using slug
        const eventData = await getEventBySlug(slug);
        
        if (!eventData) {
          setError('Evento no encontrado');
          setIsLoading(false);
          return;
        }
        
        setEvent(eventData);
        setError(null);
        
        // Trackear visualización del evento
        metaPixel.trackViewContent(eventData.name, eventData.ticket_price);
      } catch (err) {
        console.error('Error al cargar el evento:', err);
        setError('Error al cargar los datos del evento');
      } finally {
        setIsLoading(false);
      }
    };
    
    fetchEventData();
  }, [slug]);

  const handleTicketQuantityChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    
    // Permitir campo vacío para que el usuario pueda borrar
    if (value === '') {
      setTicketQuantity(0);
      return;
    }
    
    const numValue = parseInt(value);
    
    // Solo validar que sea un número válido, sin restricciones durante la escritura
    if (!isNaN(numValue) && numValue >= 0) {
      setTicketQuantity(numValue);
    }
  };

  const handleBuyTicket = () => {
    // Verificar que event existe
    if (!event) return;
    
    // Si el evento es externo y tiene una URL externa definida, siempre redirigir al link externo
    if (event.event_type === "external_url" && event.external_url && event.external_url.trim() !== "") {
      // Abrir la URL en una nueva pestaña
      window.open(event.external_url, '_blank');
      return;
    }
    
    // Para todos los eventos de venta directa (con o sin precio), navegar al checkout
    // Asegurar que la cantidad sea al menos 1
    const quantityToPass = Math.max(1, ticketQuantity);
    // Use the event slug for checkout navigation
    const eventSlug = event.slug || event.id; // Fallback to ID if no slug
    navigate(`/compra/${eventSlug}?quantity=${quantityToPass}`);
  };

  // Format date for display
  const formatDate = (dateStr: string) => {
    if (!dateStr) return '';
    
    // Parse the date string as local date to avoid timezone issues
    const [year, month, day] = dateStr.split('-').map(Number);
    const date = new Date(year, month - 1, day); // month is 0-indexed
    
    const options: Intl.DateTimeFormatOptions = { 
      year: 'numeric', 
      month: 'long', 
      day: 'numeric' 
    };
    return date.toLocaleDateString('es-ES', options);
  };

  // Format price
  const formatPrice = (price: number) => {
    // Si el precio es 0, mostrar "Entrada libre"
    if (price === 0) {
      return "Entrada libre";
    }
    
    // Si no, formatear como precio
    return new Intl.NumberFormat('es-CO', { 
      style: 'currency', 
      currency: 'COP',
      minimumFractionDigits: 0
    }).format(price);
  };

  // En el botón de compra, ajustar el texto
  const buyButtonText = () => {
    if (!event) return 'Cargando...';
    if (event.event_type === "external_url") return 'Comprar en sitio externo';
    if (ticketQuantity === 0) return 'Reservar entradas (1)';
    return 'Reservar entradas';
  };

  // Verificar si el botón debe estar deshabilitado
  const isButtonDisabled = () => {
    if (!event) return true;
    return false; // Siempre habilitado si hay evento
  };

  if (isLoading) {
    return (
      <div className="event-detail-screen">
        <TopNavBar logoOnly={true} />
        <div className="loading-container">
          <Loader size="large" color="accent" />
        </div>
      </div>
    );
  }

  if (error || !event) {
    return (
      <div className="event-detail-screen">
        <TopNavBar logoOnly={true} />
        <div className="error-container">
          <h2>Error</h2>
          <p>{error || 'No se pudo cargar el evento'}</p>
          <SecondaryButton onClick={() => navigate('/')}>
            Volver al inicio
          </SecondaryButton>
        </div>
      </div>
    );
  }

  return (
    <div className="event-detail-screen">
      <TopNavBar logoOnly={true} />

      <div className="event-content">
        <div className="event-image-container">
          <div className="event-image">
            <img 
              src={event.cover_image_url} 
              alt={event.name}
              onError={() => {
                console.error('Error loading image:', event.cover_image_url);
              }}
            />
          </div>
        </div>
        
        <div className="event-details">
          <h1 className="event-name">{event.name}</h1>
          
          <div className="event-meta">
            <div className="meta-item">
              <i className="meta-icon date-icon"></i>
              <span>{formatDate(event.date)} - {event.time}</span>
            </div>
            
            <div className="meta-item">
              <i className="meta-icon location-icon"></i>
              <span>{event.venue?.name || 'Ubicación no especificada'}, {event.city}</span>
            </div>
          </div>
          
          <div className="event-categories">
            <Chip 
              key="standup"
              label="StandUp Comedy"
              color="accent"
              size="small"
            />
            <Chip 
              key="entretenimiento"
              label="Entretenimiento"
              color="accent"
              size="small"
            />
            <Chip 
              key="impro"
              label="Impro"
              color="accent"
              size="small"
            />
          </div>
          
          <div className="event-description">
            <h3>Acerca del evento</h3>
            <p>{event.description}</p>
          </div>

          {event.venue && (
            <div className="event-venue">
              <h3>Lugar</h3>
              <p>{event.venue.name}</p>
              <p>{event.venue.address}, {event.city}</p>
            </div>
          )}
          
          <div className="event-booking">
            <div className="booking-details">
              <div className="price">
                <span className="price-label">Precio por entrada:</span>
                <span className="price-value">{formatPrice(event.ticket_price)}</span>
              </div>
              
              {event.event_type === "external_url" ? (
                <div className="external-booking-notice">
                  <div className="notice-icon">⚠️</div>
                  <div className="notice-text">
                    <p><strong>Compra externa</strong></p>
                    <p>Las entradas para este evento se compran en un sitio web externo. Serás redirigido al sitio oficial del organizador para completar tu compra.</p>
                  </div>
                </div>
              ) : (
                <div className="quantity-selector">
                  <div className="quantity-controls">
                    <CustomInput
                      type="number"
                      label="Cantidad de entradas"
                      value={ticketQuantity === 0 ? '' : ticketQuantity}
                      onChange={handleTicketQuantityChange}
                      placeholder="1"
                      className="ticket-quantity-input"
                    />
                    <SecondaryButton 
                      type="button"
                      className="quantity-btn quantity-increase"
                      onClick={() => setTicketQuantity(ticketQuantity + 1)}
                      size="small"
                    >
                      +
                    </SecondaryButton>
                    <SecondaryButton 
                      type="button"
                      className="quantity-btn quantity-decrease"
                      onClick={() => setTicketQuantity(Math.max(1, ticketQuantity - 1))}
                      disabled={ticketQuantity <= 1}
                      size="small"
                    >
                      −
                    </SecondaryButton>
                  </div>
                </div>
              )}
            </div>
            
            <PrimaryButton 
              fullWidth
              disabled={isButtonDisabled()}
              onClick={handleBuyTicket}
            >
              {buyButtonText()}
            </PrimaryButton>
            
            <SecondaryButton 
              fullWidth
              onClick={() => navigate('/')}
            >
              Volver al inicio
            </SecondaryButton>
          </div>
        </div>
      </div>
    </div>
  );
};

export default EventDetailScreen;
