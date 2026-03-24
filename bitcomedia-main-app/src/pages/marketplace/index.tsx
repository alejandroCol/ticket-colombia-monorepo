import React, { useEffect, useState, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import './index.scss';
import Chip from '../../components/Chip';
import Loader from '../../components/Loader';
import EventCard from '../../containers/EventCard';
import BottomNavBar from '../../containers/BottomNavBar';
import TopNavBar from '../../containers/TopNavBar';
import WhatsAppButton from '../../components/WhatsAppButton';
import BannerCarousel from '../../components/BannerCarousel';
import { getCurrentUser, getHomeBanners } from '../../services';
import { Timestamp, collection, getDocs, query, where, orderBy, limit, startAfter, type QueryDocumentSnapshot, type DocumentData } from 'firebase/firestore';
import { db } from '../../services/firestore';

interface EventData {
  id: string;
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

type DateFilter = 'Hoy' | 'Esta semana' | 'Este mes' | 'Proximamente';

// Default banners when none configured (2 banners de prueba - alta calidad)
const getDefaultBanners = (firstSlug?: string) => [
  {
    id: '1',
    url: 'https://images.unsplash.com/photo-1514306191717-452ec28c7814?w=1920&q=90&fit=crop',
    order: 0,
    title: 'Teatro en Vivo',
    date: '2026-04-15',
    eventSlug: firstSlug || '',
  },
  {
    id: '2',
    url: 'https://images.unsplash.com/photo-1470229722913-7c0e2dbbafd3?w=1920&q=90&fit=crop',
    order: 1,
    title: 'Noche de Improvisación',
    date: '2026-04-22',
    eventSlug: firstSlug || '',
  },
];

const MarketplaceScreen: React.FC = () => {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);
  const [activeFilter, setActiveFilter] = useState<DateFilter>('Proximamente');
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [events, setEvents] = useState<EventData[]>([]);
  const [banners, setBanners] = useState<{ id?: string; url: string; order?: number; title?: string; date?: string; eventSlug?: string }[]>(getDefaultBanners());
  const [loading, setLoading] = useState<boolean>(true);
  const [lastVisible, setLastVisible] = useState<QueryDocumentSnapshot<DocumentData> | null>(null);
  const [hasMore, setHasMore] = useState<boolean>(true);
  const [loadingMore, setLoadingMore] = useState<boolean>(false);
  const observer = useRef<IntersectionObserver | null>(null);
  const EVENTS_PER_PAGE = 10;

  const navigate = useNavigate();

  const dateFilters: DateFilter[] = ['Proximamente', 'Hoy', 'Esta semana', 'Este mes'];

  const lastEventElementRef = useCallback((node: HTMLDivElement | null) => {
    if (loading || loadingMore) return;
    if (observer.current) observer.current.disconnect();

    observer.current = new IntersectionObserver(entries => {
      if (entries[0].isIntersecting && hasMore) {
        loadMoreEvents();
      }
    });

    if (node) observer.current.observe(node);
  }, [loading, loadingMore, hasMore]);

  useEffect(() => {
    const user = getCurrentUser();
    setIsAuthenticated(!!user);
    setLastVisible(null);
    setEvents([]);
    setHasMore(true);
    fetchEvents(activeFilter, true);
  }, [activeFilter]);

  const filteredEvents = searchTerm.trim()
    ? events.filter(
        (e) =>
          e.name.toLowerCase().includes(searchTerm.toLowerCase().trim()) ||
          e.city.toLowerCase().includes(searchTerm.toLowerCase().trim())
      )
    : events;

  useEffect(() => {
    const loadBanners = async () => {
      const data = await getHomeBanners();
      if (data.length > 0) setBanners(data);
    };
    loadBanners();
  }, []);

  // Actualizar eventSlug en banners por defecto cuando carguen los eventos
  useEffect(() => {
    const firstSlug = events[0]?.slug || events[0]?.id;
    if (firstSlug && banners.some((b) => !b.eventSlug && (b.id === '1' || b.id === '2'))) {
      setBanners((prev) =>
        prev.map((b) =>
          (b.id === '1' || b.id === '2') && !b.eventSlug ? { ...b, eventSlug: firstSlug } : b
        )
      );
    }
  }, [events]);

  const createQueryForFilter = (filter: DateFilter) => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const eventsRef = collection(db, 'events');
    let eventsQuery;

    if (filter === 'Hoy') {
      const tomorrow = new Date(today);
      tomorrow.setDate(tomorrow.getDate() + 1);
      eventsQuery = query(
        eventsRef,
        where('status', '==', 'active'),
        where('event_date', '>=', Timestamp.fromDate(today)),
        where('event_date', '<', Timestamp.fromDate(tomorrow)),
        orderBy('event_date', 'asc')
      );
    } else if (filter === 'Esta semana') {
      const nextWeek = new Date(today);
      nextWeek.setDate(nextWeek.getDate() + 7);
      eventsQuery = query(
        eventsRef,
        where('status', '==', 'active'),
        where('event_date', '>=', Timestamp.fromDate(today)),
        where('event_date', '<', Timestamp.fromDate(nextWeek)),
        orderBy('event_date', 'asc')
      );
    } else if (filter === 'Este mes') {
      const endOfMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0, 23, 59, 59, 999);
      eventsQuery = query(
        eventsRef,
        where('status', '==', 'active'),
        where('event_date', '>=', Timestamp.fromDate(today)),
        where('event_date', '<=', Timestamp.fromDate(endOfMonth)),
        orderBy('event_date', 'asc')
      );
    } else {
      eventsQuery = query(
        eventsRef,
        where('status', '==', 'active'),
        where('event_date', '>=', Timestamp.fromDate(today)),
        orderBy('event_date', 'asc')
      );
    }

    return eventsQuery;
  };

  const fetchEvents = async (filter: DateFilter, isNewFilter: boolean = false) => {
    if (isNewFilter) {
      setLoading(true);
      setLastVisible(null);
    } else {
      setLoadingMore(true);
    }

    try {
      const baseQuery = createQueryForFilter(filter);
      let paginatedQuery;
      if (lastVisible && !isNewFilter) {
        paginatedQuery = query(baseQuery, startAfter(lastVisible), limit(EVENTS_PER_PAGE));
      } else {
        paginatedQuery = query(baseQuery, limit(EVENTS_PER_PAGE));
      }

      const querySnapshot = await getDocs(paginatedQuery);
      const eventsData: EventData[] = [];

      if (querySnapshot.empty) {
        setHasMore(false);
        if (isNewFilter) setEvents([]);
        return;
      }

      querySnapshot.forEach((doc) => {
        const data = doc.data() as Omit<EventData, 'id'>;
        eventsData.push({
          id: doc.id,
          ...data
        });
      });

      const lastDoc = querySnapshot.docs[querySnapshot.docs.length - 1];
      setLastVisible(lastDoc);

      if (isNewFilter) {
        setEvents(eventsData);
      } else {
        setEvents(prev => [...prev, ...eventsData]);
      }

      setHasMore(querySnapshot.docs.length === EVENTS_PER_PAGE);
    } catch (error) {
      console.error('Error fetching events:', error);
    } finally {
      if (isNewFilter) {
        setLoading(false);
      } else {
        setLoadingMore(false);
      }
    }
  };

  const loadMoreEvents = () => {
    if (!loadingMore && hasMore) {
      fetchEvents(activeFilter, false);
    }
  };

  const handleFilterClick = (filter: DateFilter) => {
    setActiveFilter(filter);
  };

  const navigateToEvent = (identifier: string, sourceEvent?: EventData) => {
    if (sourceEvent) {
      navigate(`/evento/${identifier}`, {
        state: { eventFromList: sourceEvent },
      });
    } else {
      navigate(`/evento/${identifier}`);
    }
  };

  return (
    <div className="marketplace-screen">
      <TopNavBar
        isAuthenticated={isAuthenticated}
        eventSearch={{
          value: searchTerm,
          onChange: setSearchTerm,
          placeholder: 'Nombre o ciudad…',
        }}
      />

      <div className="marketplace-hero-wrapper">
        <BannerCarousel banners={banners} intervalMs={5000} />
      </div>

      <div className="marketplace-content">
        <nav className="marketplace-filters" aria-label="Filtrar por fecha">
          {dateFilters.map((filter) => (
            <Chip
              key={filter}
              label={filter}
              color="accent"
              active={activeFilter === filter}
              onClick={() => handleFilterClick(filter)}
              size="medium"
            />
          ))}
        </nav>

        <section className="marketplace-events" aria-label="Listado de eventos">
          {loading ? (
            <div className="marketplace-loading">
              <Loader size="large" color="accent" />
            </div>
          ) : filteredEvents.length > 0 ? (
            <div className="event-grid">
              {filteredEvents.map((event, index) => (
                index === filteredEvents.length - 1 ? (
                  <div key={event.id} ref={lastEventElementRef} className="event-grid__item">
                    <EventCard
                      event={event}
                      onReserve={(identifier, _isRecurring, sourceEvent) =>
                        navigateToEvent(identifier, sourceEvent)
                      }
                    />
                  </div>
                ) : (
                  <div key={event.id} className="event-grid__item">
                    <EventCard
                      event={event}
                      onReserve={(identifier, _isRecurring, sourceEvent) =>
                        navigateToEvent(identifier, sourceEvent)
                      }
                    />
                  </div>
                )
              ))}
              {loadingMore && (
                <div className="marketplace-loading-more">
                  <Loader size="small" color="secondary" />
                </div>
              )}
            </div>
          ) : (
            <div className="marketplace-empty">
              <div className="marketplace-empty__icon" aria-hidden>📅</div>
              <p>
                {searchTerm.trim()
                  ? 'No se encontraron eventos con esa búsqueda.'
                  : 'No hay eventos para esta fecha.'}
              </p>
              <p className="marketplace-empty__hint">
                {searchTerm.trim() ? 'Prueba otro término o quita el filtro.' : 'Prueba otro filtro.'}
              </p>
            </div>
          )}
        </section>
      </div>

      <footer className="marketplace-footer">
        <span className="marketplace-footer__copy">&copy; {new Date().getFullYear()}</span>
      </footer>

      <div className="marketplace-whatsapp-fab" aria-label="Contactar por WhatsApp">
        <WhatsAppButton
          message="Hola, tengo una consulta."
          trackingLabel="marketplace-fab"
          className="marketplace-whatsapp-fab__btn"
        >
          <svg width="28" height="28" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
            <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
          </svg>
        </WhatsAppButton>
      </div>

      <BottomNavBar />
      <div className="bottom-nav-spacer" />
    </div>
  );
};

export default MarketplaceScreen;
