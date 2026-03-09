import React, { useState, useRef, useCallback } from 'react';
import './index.scss';
import Chip from '../../components/Chip';
import Loader from '../../components/Loader';
import EventCard from '../../containers/EventCard';
import BottomNavBar from '../../containers/BottomNavBar';
import TopNavBar from '../../containers/TopNavBar';
import WhatsAppButton from '../../components/WhatsAppButton';
import SecondaryButton from '../../components/SecondaryButton';
import { Timestamp } from 'firebase/firestore';

// Event data interface (exact same as Marketplace)
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

// Mock data que simula eventos reales de Firebase
const mockEventsData: EventData[] = [
  {
    id: '1',
    slug: 'stand-up-en-el-911',
    name: 'Stand Up en El 911',
    description: 'Una noche llena de entretenimiento con los mejores artistas de la ciudad. Ven y disfruta de un show único e inolvidable.',
    city: 'Bogotá',
    venue: {
      name: 'Teatro 911',
      address: 'Carrera 11 #93-07, Chapinero'
    },
    cover_image_url: 'https://images.unsplash.com/photo-1586953208448-b95a79798f07?w=400',
    date: '2024-02-15',
    time: '20:00',
    event_date: Timestamp.fromDate(new Date('2024-02-15T20:00:00')),
    ticket_price: 45000,
    status: 'active'
  },
  {
    id: '2',
    slug: 'comedy-night-live',
    name: 'Comedy Night Live',
    description: 'Show de improvisación en vivo con participación del público. Los artistas crearán historias únicas en tiempo real.',
    city: 'Bogotá',
    venue: {
      name: 'Café Central',
      address: 'Zona Rosa, Bogotá'
    },
    cover_image_url: 'https://images.unsplash.com/photo-1516450360452-9312f5e86fc7?w=400',
    date: '2024-02-18',
    time: '19:30',
    event_date: Timestamp.fromDate(new Date('2024-02-18T19:30:00')),
    ticket_price: 35000,
    status: 'active'
  },
  {
    id: '3',
    slug: 'roast-battle-championship',
    name: 'Roast Battle Championship',
    description: 'Batalla épica de artistas en formato competitivo. Los mejores talentos se enfrentan en duelos de ingenio sin piedad.',
    city: 'Bogotá',
    venue: {
      name: 'Rock Bar',
      address: 'Zona T, Bogotá'
    },
    cover_image_url: 'https://images.unsplash.com/photo-1541447270888-6d049c861588?w=400',
    date: '2024-02-20',
    time: '21:00',
    event_date: Timestamp.fromDate(new Date('2024-02-20T21:00:00')),
    ticket_price: 55000,
    status: 'active'
  },
  {
    id: '4',
    slug: 'monologos-medianoche',
    name: 'Monólogos de Medianoche',
    description: 'Show íntimo con los mejores artistas de la escena local. Una experiencia única para los amantes del entretenimiento de calidad.',
    city: 'Bogotá',
    venue: {
      name: 'La Hamburguesería',
      address: 'Chapinero, Bogotá'
    },
    cover_image_url: 'https://images.unsplash.com/photo-1594736797933-d0403ba4c966?w=400',
    date: '2024-02-22',
    time: '23:00',
    event_date: Timestamp.fromDate(new Date('2024-02-22T23:00:00')),
    ticket_price: 40000,
    status: 'active'
  },
  {
    id: '5',
    slug: 'open-mic-viernes',
    name: 'Open Mic Viernes',
    description: 'Micrófono abierto para nuevos talentos y veteranos. Descubre las nuevas voces del entretenimiento local.',
    city: 'Bogotá',
    venue: {
      name: 'Brew & Jokes',
      address: 'La Candelaria, Bogotá'
    },
    cover_image_url: 'https://images.unsplash.com/photo-1596461400994-6168ebd58818?w=400',
    date: '2024-02-23',
    time: '20:30',
    event_date: Timestamp.fromDate(new Date('2024-02-23T20:30:00')),
    ticket_price: 25000,
    status: 'active'
  },
  {
    id: '6',
    slug: 'especial-san-valentin',
    name: 'Especial de San Valentín',
    description: 'Show especial para parejas y solteros. Historias de amor, desamor y todo lo que está en el medio.',
    city: 'Bogotá',
    venue: {
      name: 'Teatro Libre',
      address: 'La Macarena, Bogotá'
    },
    cover_image_url: 'https://images.unsplash.com/photo-1518709268805-4e9042af2176?w=400',
    date: '2024-02-14',
    time: '19:00',
    event_date: Timestamp.fromDate(new Date('2024-02-14T19:00:00')),
    ticket_price: 50000,
    status: 'active'
  }
];

const MarketplaceDemo: React.FC = () => {
  const [theme, setTheme] = useState<'default' | 'teatro911'>('default');
  const [isAuthenticated] = useState<boolean>(false);
  const [activeFilter, setActiveFilter] = useState<DateFilter>('Proximamente');
  const [events, setEvents] = useState<EventData[]>(mockEventsData);
  const [loading, setLoading] = useState<boolean>(false);
  const [loadingMore] = useState<boolean>(false);
  const [hasMore] = useState<boolean>(true);
  const observer = useRef<IntersectionObserver | null>(null);

  const dateFilters: DateFilter[] = ['Proximamente', 'Hoy', 'Esta semana', 'Este mes'];

  // Reference for the last event element for infinite scrolling (mismo que el Marketplace)
  const lastEventElementRef = useCallback((node: HTMLDivElement | null) => {
    if (loading || loadingMore) return;
    if (observer.current) observer.current.disconnect();
    
    observer.current = new IntersectionObserver(entries => {
      if (entries[0].isIntersecting && hasMore) {
        // Simular carga de más eventos
        setTimeout(() => {
          console.log('Loading more events...');
        }, 1000);
      }
    });
    
    if (node) observer.current.observe(node);
  }, [loading, loadingMore, hasMore]);

  const handleFilterClick = (filter: DateFilter) => {
    setActiveFilter(filter);
    setLoading(true);
    
    // Simular filtrado de eventos
    setTimeout(() => {
      let filteredEvents = mockEventsData;
      
      if (filter === 'Hoy') {
        filteredEvents = mockEventsData.slice(0, 2);
      } else if (filter === 'Esta semana') {
        filteredEvents = mockEventsData.slice(0, 4);
      } else if (filter === 'Este mes') {
        filteredEvents = mockEventsData.slice(0, 5);
      }
      
      setEvents(filteredEvents);
      setLoading(false);
    }, 800);
  };
  
  const navigateToEvent = (identifier: string) => {
    console.log(`Navigating to event: ${identifier}`);
    // En el demo no navegamos realmente
    alert(`Demo: Navegando al evento ${identifier}`);
  };

  return (
    <div className={`marketplace-screen ${theme === 'teatro911' ? 'teatro911-theme' : 'default-theme'}`}>
      
      {/* Theme Selector - Fixed en la esquina */}
      <div className="theme-selector-demo">
        <div className="theme-selector-content">
          <span className="theme-label">Tema:</span>
          <div className="theme-buttons">
            <SecondaryButton
              theme={theme}
              onClick={() => setTheme('default')}
              className={theme === 'default' ? 'active' : ''}
              size="small"
            >
              Default
            </SecondaryButton>
            <SecondaryButton
              theme={theme}
              onClick={() => setTheme('teatro911')}
              className={theme === 'teatro911' ? 'active' : ''}
              size="small"
            >
              🎭 Teatro911
            </SecondaryButton>
          </div>
        </div>
      </div>

      {/* TopNavBar exactamente igual que en Marketplace */}
      <TopNavBar 
        isAuthenticated={isAuthenticated}
        theme={theme}
      />

      {/* Header exactamente igual que en Marketplace */}
      <div className="marketplace-header">
        <h1>{theme === 'teatro911' ? 'Shows y Eventos' : 'Descubre Eventos'}</h1>
        <p className="marketplace-hero-subtitle">
          {theme === 'teatro911' 
            ? 'Descubre y participa en los mejores eventos de entretenimiento de la ciudad'
            : 'Encuentra y participa en los mejores eventos de entretenimiento en tu ciudad'
          }
        </p>
        <p className="marketplace-whatsapp-contact">
          Recuerda que también nos puedes contactar por{' '}
          <WhatsAppButton 
            message="Hola, me gustaría obtener más información sobre los eventos disponibles."
            trackingLabel="marketplace-contact"
            theme={theme}
          >
            WhatsApp
          </WhatsAppButton>
        </p>
      </div>

      {/* Content exactamente igual que en Marketplace */}
      <div className="marketplace-content">
        <div className="marketplace-section">
          <div className="category-list">
            {dateFilters.map((filter) => (
              <Chip
                key={filter}
                label={filter}
                color="accent"
                active={activeFilter === filter}
                onClick={() => handleFilterClick(filter)}
                theme={theme}
              />
            ))}
          </div>
        </div>

        <div className="marketplace-section">
          {loading ? (
            <div className="loading-container">
              <Loader size="large" color="accent" theme={theme} />
            </div>
          ) : events.length > 0 ? (
            <div className="event-grid">
              {events.map((event, index) => {
                // Add ref to last element for infinite scrolling (exactamente igual)
                if (events.length === index + 1) {
                  return (
                    <div key={event.id} ref={lastEventElementRef}>
                      <EventCard 
                        event={event} 
                        onReserve={navigateToEvent}
                        theme={theme}
                      />
                    </div>
                  );
                } else {
                  return (
                    <EventCard 
                      key={event.id} 
                      event={event} 
                      onReserve={navigateToEvent}
                      theme={theme}
                    />
                  );
                }
              })}
              {loadingMore && (
                <div className="loading-more">
                  <Loader size="small" color="secondary" theme={theme} />
                </div>
              )}
            </div>
          ) : (
            <p>No hay eventos disponibles para el filtro seleccionado.</p>
          )}
        </div>

        {/* Demo Notice */}
        <div className="marketplace-section">
          <div className="demo-notice">
            <h2>🎭 Design System Demo</h2>
            <p>
              Esta es una demostración del sistema de temas aplicado al Marketplace real. 
              Cambia entre temas usando el selector de la esquina superior derecha.
            </p>
            <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', marginTop: '1rem' }}>
              <Chip label="Componentes reales" color="success" theme={theme} />
              <Chip label="EventCard original" color="accent" theme={theme} />
              <Chip label="TopNavBar/BottomNavBar" color="primary" theme={theme} />
              <Chip label="Datos mock" color="warning" theme={theme} />
            </div>
          </div>
        </div>
      </div>

      {/* Footer exactamente igual que en Marketplace */}
      <footer className="marketplace-footer">
        <p>&copy; {new Date().getFullYear()} Todos los derechos reservados.</p>
      </footer>
      
      {/* BottomNavBar exactamente igual que en Marketplace */}
      <BottomNavBar theme={theme} />
      
      {/* Spacer exactamente igual que en Marketplace */}
      <div className="bottom-nav-spacer"></div>
    </div>
  );
};

export default MarketplaceDemo;