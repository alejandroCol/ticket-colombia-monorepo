import React, { useEffect, useState } from 'react';
import { useNavigate, useParams, useLocation } from 'react-router-dom';
import {
  getEventBySlug,
  getEventAvailability,
  metaPixel,
  type AvailabilityResponse,
} from '../../services';
import type { Event, EventSection } from '../../services/types';
import Chip from '../../components/Chip';
import CustomInput from '../../components/CustomInput';
import PrimaryButton from '../../components/PrimaryButton';
import SecondaryButton from '../../components/SecondaryButton';
import TopNavBar from '../../containers/TopNavBar';
import Loader from '../../components/Loader';
import VenueMapInteractive from '../../components/VenueMapInteractive';
import './index.scss';

function displayAvailable(remaining: number, capacity: number): number {
  if (capacity <= 0) return 0;
  const threshold = Math.floor(capacity * 0.3);
  return remaining > threshold ? Math.floor(capacity * 0.7) : remaining;
}

function sectionRemaining(
  sec: EventSection,
  availability: Record<string, number>
): number {
  const sold = availability[sec.name] || availability[sec.id] || 0;
  return Math.max(0, sec.available - sold);
}

type EventLocationState = { eventFromList?: Event };

const EventDetailScreen: React.FC = () => {
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [event, setEvent] = useState<Event | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [ticketQuantity, setTicketQuantity] = useState<number>(1);
  const [selectedSection, setSelectedSection] = useState<EventSection | null>(null);
  const [availability, setAvailability] = useState<Record<string, number>>({});
  const [totalSold, setTotalSold] = useState(0);
  const [availabilityReady, setAvailabilityReady] = useState(false);
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();
  const location = useLocation();

  const sections = event?.sections && event.sections.length > 0 ? event.sections : null;
  const price = selectedSection ? selectedSection.price : (event?.ticket_price ?? 0);
  const capacity = selectedSection ? selectedSection.available : (event?.capacity_per_occurrence ?? 0);
  const sold = selectedSection ? (availability[selectedSection.name] || availability[selectedSection.id] || 0) : (availability['General'] ?? totalSold);
  const remaining = Math.max(0, capacity - sold);
  const showAvailable = displayAvailable(remaining, capacity);
  
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [slug]);

  useEffect(() => {
    let cancelled = false;
    const state = location.state as EventLocationState | null;
    const seedEvent = state?.eventFromList;
    const seedMatches =
      Boolean(slug && seedEvent && (seedEvent.slug === slug || seedEvent.id === slug));

    const applyAvailability = (avail: AvailabilityResponse) => {
      const bySec: Record<string, number> = {};
      Object.entries(avail.bySection || {}).forEach(([k, v]) => {
        bySec[k] = v;
      });
      if (avail.generalSold !== undefined) bySec['General'] = avail.generalSold;
      setAvailability(bySec);
      setTotalSold(avail.totalSold ?? 0);
      setAvailabilityReady(true);
    };

    (async () => {
      if (!slug) {
        setError('Slug del evento no proporcionado');
        setIsLoading(false);
        setAvailabilityReady(true);
        return;
      }

      try {
        setError(null);

        if (seedMatches && seedEvent) {
          setEvent(seedEvent);
          const seedSecs = seedEvent.sections;
          if (seedSecs?.length) setSelectedSection(seedSecs[0]);
          else setSelectedSection(null);
          setAvailability({});
          setTotalSold(0);
          setAvailabilityReady(false);
          setIsLoading(false);
        } else {
          setIsLoading(true);
          setAvailabilityReady(false);
        }

        const eventPromise = getEventBySlug(slug);
        const availPromise =
          seedMatches && seedEvent ? getEventAvailability(seedEvent.id) : null;

        const eventData = await eventPromise;
        if (cancelled) return;

        if (!eventData) {
          setError('Evento no encontrado');
          setEvent(null);
          setIsLoading(false);
          setAvailabilityReady(true);
          return;
        }

        setEvent(eventData);
        const secs = eventData.sections;
        if (secs?.length) setSelectedSection(secs[0]);
        else setSelectedSection(null);

        if (!seedMatches) {
          setIsLoading(false);
        }

        let avail: AvailabilityResponse;
        if (availPromise && seedEvent) {
          const parallelAvail = await availPromise;
          if (cancelled) return;
          if (eventData.id === seedEvent.id) {
            avail = parallelAvail;
          } else {
            avail = await getEventAvailability(eventData.id);
          }
        } else {
          avail = await getEventAvailability(eventData.id);
        }
        if (cancelled) return;

        applyAvailability(avail);
        metaPixel.trackViewContent(eventData.name, eventData.ticket_price);
      } catch (err) {
        if (cancelled) return;
        console.error('Error al cargar el evento:', err);
        setError('Error al cargar los datos del evento');
        setIsLoading(false);
        setAvailabilityReady(true);
      }
    })();

    return () => {
      cancelled = true;
    };
    // Intencional: leer state del listado en la misma navegación; no depender del objeto `state` (referencia inestable).
    // eslint-disable-next-line react-hooks/exhaustive-deps -- slug dispara recarga; state se lee del último `location`.
  }, [slug]);

  /** Si la localidad por defecto quedó sin cupo, pasar a la primera con cupo */
  useEffect(() => {
    if (!sections?.length || !Object.keys(availability).length) return;
    if (!selectedSection) return;
    if (sectionRemaining(selectedSection, availability) > 0) return;
    const next = sections.find((s) => sectionRemaining(s, availability) > 0);
    if (next) setSelectedSection(next);
  }, [sections, availability, selectedSection]);

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
    if (!event) return;

    if (event.event_type === "external_url" && event.external_url?.trim()) {
      window.open(event.external_url, '_blank');
      return;
    }

    if (ticketQuantity > remaining) return;

    const quantityToPass = Math.max(1, ticketQuantity);
    const eventSlug = event.slug || event.id;
    const params = new URLSearchParams({ quantity: String(quantityToPass) });
    if (selectedSection) {
      params.set('sectionId', selectedSection.id);
      params.set('sectionName', selectedSection.name);
    }
    navigate(`/compra/${eventSlug}?${params.toString()}`);
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
    if (!availabilityReady) return 'Comprobando disponibilidad…';
    if (ticketQuantity === 0) return 'Reservar entradas (1)';
    return 'Reservar entradas';
  };

  const isExternalEvent =
    Boolean(
      event?.event_type === 'external_url' && event.external_url?.trim()
    );

  const isButtonDisabled = () => {
    if (!event) return true;
    if (!isExternalEvent && !availabilityReady) return true;
    if (ticketQuantity < 1) return true;
    if (ticketQuantity > remaining) return true;
    if (
      sections &&
      selectedSection &&
      sectionRemaining(selectedSection, availability) <= 0
    ) {
      return true;
    }
    return false;
  };

  const displayLabels = (event?.event_labels || []).slice(0, 5);

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

          <div className="event-hero-panel">
            <h1 className="event-hero-panel__title">{event.name}</h1>

            <div className="event-hero-panel__meta">
              <div className="event-hero-panel__meta-row">
                <span className="event-hero-panel__meta-icon event-hero-panel__meta-icon--date" aria-hidden />
                <div className="event-hero-panel__meta-text">
                  <span className="event-hero-panel__meta-label">Fecha y hora</span>
                  <span className="event-hero-panel__meta-value">
                    {formatDate(event.date)} · {event.time}
                  </span>
                </div>
              </div>
              <div className="event-hero-panel__meta-row">
                <span className="event-hero-panel__meta-icon event-hero-panel__meta-icon--place" aria-hidden />
                <div className="event-hero-panel__meta-text">
                  <span className="event-hero-panel__meta-label">Ubicación</span>
                  <span className="event-hero-panel__meta-value">
                    {event.venue?.name || 'Por confirmar'}
                    <span className="event-hero-panel__meta-sep">·</span>
                    {event.city}
                  </span>
                </div>
              </div>
            </div>

            {displayLabels.length > 0 && (
              <div className="event-hero-panel__chips">
                {displayLabels.map((label) => (
                  <Chip key={label} label={label} color="accent" size="small" />
                ))}
              </div>
            )}

            <section className="event-hero-panel__section" aria-labelledby="hero-about-heading">
              <h2 id="hero-about-heading" className="event-hero-panel__section-title">
                Acerca del evento
              </h2>
              <p className="event-hero-panel__section-body">{event.description}</p>
            </section>

            {event.venue && (
              <section className="event-hero-panel__venue-card" aria-labelledby="hero-venue-heading">
                <h2 id="hero-venue-heading" className="event-hero-panel__section-title">
                  Lugar
                </h2>
                <p className="event-hero-panel__venue-name">{event.venue.name}</p>
                <p className="event-hero-panel__venue-address">
                  {event.venue.address}
                  <span className="event-hero-panel__venue-city">, {event.city}</span>
                </p>
              </section>
            )}
          </div>
        </div>

        <div className="event-details">
          <div className="event-booking">
            <div className="event-booking__header">
              <h2 className="event-booking__title">Tu entrada</h2>
              <p className="event-booking__subtitle">Elige localidad y cantidad</p>
            </div>
            <div className="booking-details">
              {(() => {
                const vis = event.venue_map?.visual;
                const DEFAULT_VENUE_MAP_BG = "#1a1a28";
                const flat = (vis?.flatRenderUrl || "").trim();
                const legacy = (event.venue_map_url || "").trim();
                const mapRasterUrl = flat || legacy;
                const hasMapImage = Boolean(mapRasterUrl);
                const hasMapVisual = Boolean(
                  vis &&
                    ((vis.decorations?.length ?? 0) > 0 ||
                      (vis.backgroundImageUrl || "").trim() ||
                      (vis.background &&
                        vis.background.toLowerCase() !== DEFAULT_VENUE_MAP_BG))
                );
                const mapZones = event.venue_map?.zones ?? [];
                if (!hasMapImage && !hasMapVisual) return null;
                if (!sections) return null;
                return (
                  <VenueMapInteractive
                    imageUrl={mapRasterUrl || undefined}
                    visual={vis}
                    zones={mapZones}
                    sections={sections}
                    selectedSectionId={selectedSection?.id}
                    onSelectSection={(sec) => setSelectedSection(sec)}
                  />
                );
              })()}
              {sections && (
                <div className="event-section-picker" role="radiogroup" aria-label="Localidad">
                  <span className="event-section-picker__label" id="section-picker-label">
                    Localidad
                  </span>
                  <div className="event-section-picker__grid" aria-labelledby="section-picker-label">
                    {sections.map((sec) => {
                      const rem = sectionRemaining(sec, availability);
                      const shown = displayAvailable(rem, sec.available);
                      const selected = selectedSection?.id === sec.id;
                      const soldOut = rem <= 0;
                      const low = rem > 0 && rem <= Math.max(1, Math.floor(sec.available * 0.15));
                      return (
                        <button
                          key={sec.id}
                          type="button"
                          role="radio"
                          aria-checked={selected}
                          disabled={soldOut}
                          className={
                            'event-section-card' +
                            (selected ? ' event-section-card--selected' : '') +
                            (soldOut ? ' event-section-card--soldout' : '') +
                            (low && !soldOut ? ' event-section-card--low' : '')
                          }
                          onClick={() => setSelectedSection(sec)}
                        >
                          <span className="event-section-card__name">{sec.name}</span>
                          <span className="event-section-card__price">{formatPrice(sec.price)}</span>
                          {soldOut ? (
                            <span className="event-section-card__badge event-section-card__badge--soldout">
                              Agotada
                            </span>
                          ) : low ? (
                            <span className="event-section-card__badge event-section-card__badge--low">
                              Pocas plazas
                            </span>
                          ) : (
                            <span className="event-section-card__badge">
                              ~{shown} disponibles
                            </span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
              {!sections && (
                <p className="availability-pill availability-pill--solo">
                  <span className="availability-pill__dot" aria-hidden />
                  Quedan ~{showAvailable} entradas
                </p>
              )}
              {sections &&
                selectedSection &&
                sectionRemaining(selectedSection, availability) > 0 && (
                <p className="availability-pill">
                  <span className="availability-pill__dot" aria-hidden />
                  ~{showAvailable} en <strong>{selectedSection.name}</strong>
                </p>
              )}
              {sections &&
                selectedSection &&
                sectionRemaining(selectedSection, availability) <= 0 && (
                <p className="availability-pill availability-pill--warn">
                  Esta localidad no tiene cupo. Elige otra.
                </p>
              )}
              <div className="event-price-row">
                <span className="event-price-row__label">Precio por entrada</span>
                <span className="event-price-row__value">{formatPrice(price)}</span>
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
                  <span className="quantity-selector__label">Cantidad</span>
                  <div className="quantity-controls">
                    <SecondaryButton 
                      type="button"
                      className="quantity-btn quantity-decrease"
                      onClick={() => setTicketQuantity(Math.max(1, ticketQuantity - 1))}
                      disabled={ticketQuantity <= 1}
                      size="small"
                      aria-label="Menos entradas"
                    >
                      −
                    </SecondaryButton>
                    <CustomInput
                      type="number"
                      label=""
                      value={ticketQuantity === 0 ? '' : ticketQuantity}
                      onChange={handleTicketQuantityChange}
                      placeholder="1"
                      className="ticket-quantity-input"
                      aria-label="Cantidad de entradas"
                    />
                    <SecondaryButton 
                      type="button"
                      className="quantity-btn quantity-increase"
                      onClick={() => setTicketQuantity(ticketQuantity + 1)}
                      size="small"
                      aria-label="Más entradas"
                    >
                      +
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
