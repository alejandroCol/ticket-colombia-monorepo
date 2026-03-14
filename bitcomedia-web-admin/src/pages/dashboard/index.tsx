import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { collection, getDocs, query, where, Timestamp } from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import PrimaryButton from '@components/PrimaryButton';
import SecondaryButton from '@components/SecondaryButton';
import EventCard from '@containers/EventCard';
import TopNavBar from '@TopNavBar';
import CreateTicketModal, { type TicketFormData } from '@components/CreateTicketModal';
import { logoutUser, db, functions } from '@services';
import './index.scss';

import type { EventSection } from '@services/types';

// Event data interface
interface EventData {
  id: string;
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
  sections?: EventSection[];
  capacity_per_occurrence: number;
  event_type: string;
  creation_date: Timestamp;
  organizer_id: string;
  status: string;
  is_recurring: boolean;
  [key: string]: string | number | boolean | Timestamp | Date | object | undefined;
}

// Recurring Event data interface
interface RecurringEventData extends EventData {
  recurrence_pattern: string;
  is_recurring: boolean;
}

const DashboardScreen: React.FC = () => {
  const [events, setEvents] = useState<EventData[]>([]);
  const [recurringEvents, setRecurringEvents] = useState<RecurringEventData[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingRecurring, setLoadingRecurring] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [errorRecurring, setErrorRecurring] = useState<string | null>(null);
  const [isRecurringCollapsed, setIsRecurringCollapsed] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedEvent, setSelectedEvent] = useState<EventData | null>(null);
  const navigate = useNavigate();
  
  // Fetch recurring events from Firestore
  useEffect(() => {
    const fetchRecurringEvents = async () => {
      try {
        setLoadingRecurring(true);
        
        // Create a query against the recurring_events collection
        // Get both active and inactive recurring events
        const recurringEventsQuery = query(
          collection(db, 'recurring_events')
        );
        
        const querySnapshot = await getDocs(recurringEventsQuery);
        const recurringEventsData: RecurringEventData[] = [];
        
        querySnapshot.forEach((doc) => {
          const data = doc.data();
          recurringEventsData.push({
            id: doc.id,
            name: data.name,
            description: data.description,
            city: data.city,
            venue: data.venue,
            cover_image_url: data.cover_image_url,
            date: data.date || '',
            time: data.time,
            event_date: data.event_date || Timestamp.now(),
            ticket_price: data.ticket_price || 0,
            sections: data.sections || [],
            capacity_per_occurrence: data.capacity_per_occurrence || 0,
            event_type: data.event_type || 'bitcomedia_direct',
            creation_date: data.creation_date,
            organizer_id: data.organizer_id || '',
            status: data.status,
            recurrence_pattern: data.recurrence_pattern,
            is_recurring: true
          });
        });
        
        // Sort by name
        recurringEventsData.sort((a, b) => {
          return a.name.localeCompare(b.name);
        });
        
        setRecurringEvents(recurringEventsData);
      } catch (err) {
        console.error('Error fetching recurring events:', err);
        setErrorRecurring('No se pudieron cargar los eventos recurrentes. Intente de nuevo más tarde.');
      } finally {
        setLoadingRecurring(false);
      }
    };
    
    fetchRecurringEvents();
  }, []);
  
  // Fetch events from Firestore
  useEffect(() => {
    const fetchEvents = async () => {
      try {
        setLoading(true);
        
        // Get the start of today to filter events from today onwards
        const today = new Date();
        today.setHours(0, 0, 0, 0); // Set to beginning of today
        const todayTimestamp = Timestamp.fromDate(today);
        
        // Create a query against the events collection
        // Get only future events (from today onwards)
        const eventsQuery = query(
          collection(db, 'events'),
          where('event_date', '>=', todayTimestamp)
        );
        
        const querySnapshot = await getDocs(eventsQuery);
        const eventsData: EventData[] = [];
        
        querySnapshot.forEach((doc) => {
          const data = doc.data();
          eventsData.push({
            id: doc.id,
            name: data.name,
            description: data.description,
            city: data.city,
            venue: data.venue,
            cover_image_url: data.cover_image_url,
            date: data.date,
            time: data.time,
            event_date: data.event_date,
            ticket_price: data.ticket_price || 0,
            sections: data.sections || [],
            capacity_per_occurrence: data.capacity_per_occurrence || 0,
            event_type: data.event_type || 'bitcomedia_direct',
            creation_date: data.creation_date,
            organizer_id: data.organizer_id || '',
            status: data.status,
            is_recurring: false
          });
        });
        
        // Sort events by date (nearest first)
        eventsData.sort((a, b) => {
          return a.event_date.toMillis() - b.event_date.toMillis();
        });
        
        setEvents(eventsData);
      } catch (err) {
        console.error('Error fetching events:', err);
        setError('No se pudieron cargar los eventos. Intente de nuevo más tarde.');
      } finally {
        setLoading(false);
      }
    };
    
    fetchEvents();
  }, []);
  
  const handleAddEvent = () => {
    navigate('/events/new');
  };
  
  const handleAddRecurringEvent = () => {
    navigate('/recurring-events/new');
  };

  const handleReserveEvent = (eventId: string, isRecurring: boolean = false) => {
    // Navigate to appropriate edit page based on event type
    if (isRecurring) {
      navigate(`/recurring-events/${eventId}`);
    } else {
      navigate(`/events/${eventId}`);
    }
  };

  const handleViewStats = (eventId: string) => {
    navigate(`/events/${eventId}/stats`);
  };

  const handleToggleRecurringSection = () => {
    setIsRecurringCollapsed(!isRecurringCollapsed);
  };

  const handleLogout = async () => {
    try {
      await logoutUser();
      // The auth state observer will handle redirecting to login
    } catch (error) {
      console.error('Logout error:', error);
    }
  };

  const handleCreateTicket = (eventId: string, eventName: string, eventPrice: number) => {
    // Buscar el evento completo en la lista
    const event = [...events, ...recurringEvents].find(e => e.id === eventId);
    if (event) {
      setSelectedEvent(event);
      setIsModalOpen(true);
    } else {
      // Fallback si no se encuentra el evento
      setSelectedEvent({ 
        id: eventId, 
        name: eventName, 
        ticket_price: eventPrice,
        description: '',
        city: '',
        venue: { name: '', address: '' },
        cover_image_url: '',
        date: '',
        time: '',
        event_date: Timestamp.now(),
        sections: [],
        capacity_per_occurrence: 0,
        event_type: 'bitcomedia_direct',
        creation_date: Timestamp.now(),
        organizer_id: '',
        status: 'active',
        is_recurring: false
      });
      setIsModalOpen(true);
    }
  };

  const handleModalClose = () => {
    setIsModalOpen(false);
    setSelectedEvent(null);
  };

  const handleViewTickets = (eventId: string) => {
    navigate(`/events/${eventId}/tickets`);
  };

  const handleModalSubmit = async (ticketData: TicketFormData) => {
    if (!selectedEvent) return;

    try {
      const createManualTicket = httpsCallable(functions, 'createManualTicket');
      
      const result = await createManualTicket({
        eventId: selectedEvent.id,
        buyerName: ticketData.buyerName,
        buyerEmail: ticketData.buyerEmail,
        buyerPhone: ticketData.buyerPhone || '',
        buyerIdNumber: ticketData.buyerIdNumber || '',
        quantity: ticketData.quantity,
        sectionId: ticketData.sectionId || undefined,
        sectionName: ticketData.sectionName || undefined,
        isCourtesy: ticketData.isCourtesy ?? false,
        isGeneralCourtesy: ticketData.isGeneralCourtesy ?? false,
        giftedBy: ticketData.giftedBy?.trim() || undefined
      });

      console.log('Ticket created successfully:', result.data);
      const msg = ticketData.isCourtesy
        ? `✅ ${ticketData.quantity} ticket(s) de cortesía creado(s).\n\nCorreo enviado a ${ticketData.buyerEmail}.`
        : `✅ ${ticketData.quantity} ticket(s) creado(s) exitosamente!\n\nCorreo enviado a ${ticketData.buyerEmail}.`;
      alert(msg);
      
      handleModalClose();
    } catch (error: any) {
      console.error('Error creating manual ticket:', error);
      throw new Error(error.message || 'Error al crear el ticket. Intente de nuevo.');
    }
  };

  return (
    <div className="dashboard-screen">
      {/* Admin Navigation Bar */}
      <TopNavBar 
        logoOnly={true} 
        showLogout={true} 
        onLogout={handleLogout}
      />

      <div className="dashboard-content">
        <div className="dashboard-header">
          <div className="header-title-wrapper">
            <h1>Eventos recurrentes</h1>
            <button 
              className="collapse-button"
              onClick={handleToggleRecurringSection}
              aria-label={isRecurringCollapsed ? "Expandir eventos recurrentes" : "Colapsar eventos recurrentes"}
            >
              {isRecurringCollapsed ? '▼' : '▲'}
            </button>
          </div>
          <div className="header-actions desktop-only">
            <PrimaryButton onClick={handleAddRecurringEvent}>
              + Recurrente
            </PrimaryButton>
          </div>
        </div>
        
        {!isRecurringCollapsed && (
          <div className="events-container">
            {loadingRecurring ? (
              <div className="loading-state">
                <p>Cargando eventos recurrentes...</p>
              </div>
            ) : errorRecurring ? (
              <div className="error-state">
                <p>{errorRecurring}</p>
              </div>
            ) : recurringEvents.length > 0 ? (
              <div className="events-grid">
                {recurringEvents.map((event) => (
                  <EventCard
                    key={event.id}
                    event={event}
                    onReserve={handleReserveEvent}
                    onCreateTicket={handleCreateTicket}
                    onViewTickets={(eventId) => handleViewTickets(eventId)}
                    onViewStats={handleViewStats}
                  />
                ))}
              </div>
            ) : (
              <div className="empty-state">
                <p>No hay eventos recurrentes para mostrar</p>
              </div>
            )}
          </div>
        )}

        <div className="dashboard-header">
          <h1>Eventos</h1>
          <div className="header-actions desktop-only">
            <PrimaryButton onClick={handleAddEvent}>
              + Evento
            </PrimaryButton>
          </div>
        </div>
        
        <div className="events-container">
          {loading ? (
            <div className="loading-state">
              <p>Cargando eventos...</p>
            </div>
          ) : error ? (
            <div className="error-state">
              <p>{error}</p>
            </div>
          ) : events.length > 0 ? (
            <div className="events-grid">
              {events.map((event) => (
                <EventCard
                  key={event.id}
                  event={event}
                  onReserve={handleReserveEvent}
                  onCreateTicket={handleCreateTicket}
                  onViewTickets={(eventId) => handleViewTickets(eventId)}
                  onViewStats={handleViewStats}
                />
              ))}
            </div>
          ) : (
            <div className="empty-state">
              <p>No hay eventos para mostrar</p>
            </div>
          )}
        </div>
      </div>
      
      {/* Mobile fixed button */}
      <div className="mobile-fixed-button">
        <div className="mobile-button-group">
          <PrimaryButton onClick={handleAddEvent} fullWidth>
            + Evento
          </PrimaryButton>
          <SecondaryButton onClick={handleAddRecurringEvent} fullWidth>
            + Recurrente
          </SecondaryButton>
        </div>
      </div>

      {/* Create Ticket Modal */}
      {selectedEvent && (
        <CreateTicketModal
          isOpen={isModalOpen}
          onClose={handleModalClose}
          onSubmit={handleModalSubmit}
          event={selectedEvent}
        />
      )}

    </div>
  );
};

export default DashboardScreen;
