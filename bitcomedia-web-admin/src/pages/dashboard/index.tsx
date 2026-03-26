import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { collection, getDocs, query, where, Timestamp, doc, getDoc } from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import PrimaryButton from '@components/PrimaryButton';
import SecondaryButton from '@components/SecondaryButton';
import EventCard from '@containers/EventCard';
import type { EventCardActionMask } from '@containers/EventCard';
import TopNavBar from '@TopNavBar';
import CreateTicketModal, { type TicketFormData } from '@components/CreateTicketModal';
import { IconScanTickets } from '@components/ScanIcons';
import {
  logoutUser,
  db,
  functions,
  getCurrentUser,
  isSuperAdmin,
  getTicketsSince,
  isTicketValidForSalesStats,
  ticketCreatedAtMs,
  getUserData,
  listPartnerGrantsForUser,
  DEFAULT_PARTNER_PERMISSIONS,
} from '@services';
import type { PartnerEventPermissions } from '@services';
import './index.scss';

import type { EventSection } from '@services/types';
import type { Ticket } from '@services/types';

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

function eventTimestampMillis(ts: Timestamp | undefined | null): number | null {
  if (!ts || typeof ts.toMillis !== 'function') return null;
  return ts.toMillis();
}

function startOfLocalDayFromInput(dateStr: string): number {
  const [y, m, d] = dateStr.split('-').map(Number);
  return new Date(y, m - 1, d, 0, 0, 0, 0).getTime();
}

function endOfLocalDayFromInput(dateStr: string): number {
  const [y, m, d] = dateStr.split('-').map(Number);
  return new Date(y, m - 1, d, 23, 59, 59, 999).getTime();
}

function startOfLocalDay(d = new Date()): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate(), 0, 0, 0, 0);
}

function startOfLocalWeekMonday(d = new Date()): Date {
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  const monday = new Date(d);
  monday.setDate(d.getDate() + diff);
  monday.setHours(0, 0, 0, 0);
  return monday;
}

const DashboardScreen: React.FC = () => {
  const [events, setEvents] = useState<EventData[]>([]);
  const [recurringEvents, setRecurringEvents] = useState<RecurringEventData[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingRecurring, setLoadingRecurring] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [errorRecurring, setErrorRecurring] = useState<string | null>(null);
  const [isRecurringCollapsed, setIsRecurringCollapsed] = useState(true);
  const [topSoldExpanded, setTopSoldExpanded] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedEvent, setSelectedEvent] = useState<EventData | null>(null);
  const [eventNameQuery, setEventNameQuery] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const navigate = useNavigate();
  const [dashTickets, setDashTickets] = useState<Ticket[]>([]);
  const [dashTicketsLoading, setDashTicketsLoading] = useState(false);
  const [isPartnerUser, setIsPartnerUser] = useState(false);
  const [partnerGrantMap, setPartnerGrantMap] = useState<Record<string, PartnerEventPermissions>>({});

  const partnerScanAny = useMemo(
    () => isPartnerUser && Object.values(partnerGrantMap).some((p) => p.scan_validate),
    [isPartnerUser, partnerGrantMap]
  );

  function eventCardMaskFor(eventId: string | undefined): EventCardActionMask | undefined {
    if (!isPartnerUser || !eventId) return undefined;
    const p = partnerGrantMap[eventId];
    if (!p) {
      return {
        canEdit: false,
        canCreateTickets: false,
        canViewTickets: false,
        canViewStats: false,
      };
    }
    return {
      canEdit: p.edit_event,
      canCreateTickets: p.create_tickets,
      canViewTickets: p.read_tickets,
      canViewStats: p.view_stats,
    };
  }

  const filteredEvents = useMemo(() => {
    const q = eventNameQuery.trim().toLowerCase();
    const fromMs = dateFrom ? startOfLocalDayFromInput(dateFrom) : null;
    const toMs = dateTo ? endOfLocalDayFromInput(dateTo) : null;

    return events.filter((e) => {
      if (q) {
        const name = (e.name || '').toLowerCase();
        if (!name.includes(q)) return false;
      }
      const ms = eventTimestampMillis(e.event_date);
      if (ms == null) return !fromMs && !toMs;
      if (fromMs != null && ms < fromMs) return false;
      if (toMs != null && ms > toMs) return false;
      return true;
    });
  }, [events, eventNameQuery, dateFrom, dateTo]);

  const filteredRecurringEvents = useMemo(() => {
    const q = eventNameQuery.trim().toLowerCase();
    const fromMs = dateFrom ? startOfLocalDayFromInput(dateFrom) : null;
    const toMs = dateTo ? endOfLocalDayFromInput(dateTo) : null;

    return recurringEvents.filter((e) => {
      if (q) {
        const name = (e.name || '').toLowerCase();
        if (!name.includes(q)) return false;
      }
      const ms = eventTimestampMillis(e.event_date);
      if (ms == null) return !fromMs && !toMs;
      if (fromMs != null && ms < fromMs) return false;
      if (toMs != null && ms > toMs) return false;
      return true;
    });
  }, [recurringEvents, eventNameQuery, dateFrom, dateTo]);

  const hasActiveFilters = Boolean(eventNameQuery.trim() || dateFrom || dateTo);

  const clearEventFilters = () => {
    setEventNameQuery('');
    setDateFrom('');
    setDateTo('');
  };
  
  // Fetch recurring events from Firestore
  useEffect(() => {
    const fetchRecurringEvents = async () => {
      try {
        setLoadingRecurring(true);
        const user = getCurrentUser();
        const superAdmin = user ? await isSuperAdmin(user.uid) : false;
        const ud = user ? await getUserData(user.uid) : null;
        const isPartner = ud?.role === 'PARTNER';

        if (user && isPartner && !superAdmin) {
          const grants = await listPartnerGrantsForUser(user.uid);
          const grantMap: Record<string, PartnerEventPermissions> = {};
          for (const g of grants) {
            const cur = grantMap[g.event_id] || { ...DEFAULT_PARTNER_PERMISSIONS };
            grantMap[g.event_id] = {
              read_tickets: cur.read_tickets || g.permissions.read_tickets,
              create_tickets: cur.create_tickets || g.permissions.create_tickets,
              edit_event: cur.edit_event || g.permissions.edit_event,
              view_stats: cur.view_stats || g.permissions.view_stats,
              scan_validate: cur.scan_validate || g.permissions.scan_validate,
            };
          }
          setPartnerGrantMap(grantMap);
          setIsPartnerUser(true);
          const recurringEventsData: RecurringEventData[] = [];
          for (const g of grants) {
            if (g.event_path !== 'recurring_events') continue;
            const snap = await getDoc(doc(db, 'recurring_events', g.event_id));
            if (!snap.exists()) continue;
            const data = snap.data();
            recurringEventsData.push({
              id: snap.id,
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
              is_recurring: true,
            });
          }
          recurringEventsData.sort((a, b) => a.name.localeCompare(b.name));
          setRecurringEvents(recurringEventsData);
          setLoadingRecurring(false);
          return;
        }
        setIsPartnerUser(false);
        setPartnerGrantMap({});

        // Super admin: all. Regular admin: only their recurring events
        const recRef = collection(db, 'recurring_events');
        const recurringEventsQuery = superAdmin
          ? query(recRef)
          : user
            ? query(recRef, where('organizer_id', '==', user.uid))
            : query(recRef);
        
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
        const user = getCurrentUser();
        const superAdmin = user ? await isSuperAdmin(user.uid) : false;
        const ud = user ? await getUserData(user.uid) : null;
        const isPartner = ud?.role === 'PARTNER';

        if (user && isPartner && !superAdmin) {
          const grants = await listPartnerGrantsForUser(user.uid);
          const grantMap: Record<string, PartnerEventPermissions> = {};
          for (const g of grants) {
            const cur = grantMap[g.event_id] || { ...DEFAULT_PARTNER_PERMISSIONS };
            grantMap[g.event_id] = {
              read_tickets: cur.read_tickets || g.permissions.read_tickets,
              create_tickets: cur.create_tickets || g.permissions.create_tickets,
              edit_event: cur.edit_event || g.permissions.edit_event,
              view_stats: cur.view_stats || g.permissions.view_stats,
              scan_validate: cur.scan_validate || g.permissions.scan_validate,
            };
          }
          setPartnerGrantMap(grantMap);
          setIsPartnerUser(true);
          const eventsData: EventData[] = [];
          for (const g of grants) {
            if (g.event_path !== 'events') continue;
            const snap = await getDoc(doc(db, 'events', g.event_id));
            if (!snap.exists()) continue;
            const data = snap.data();
            eventsData.push({
              id: snap.id,
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
              is_recurring: false,
            });
          }
          const now = Date.now();
          eventsData.sort((a, b) => {
            const ma = a.event_date.toMillis();
            const mb = b.event_date.toMillis();
            const aFuture = ma >= now;
            const bFuture = mb >= now;
            if (aFuture && bFuture) return ma - mb;
            if (!aFuture && !bFuture) return mb - ma;
            return aFuture ? -1 : 1;
          });
          setEvents(eventsData);
          setLoading(false);
          return;
        }

        // Super admin: all events. Regular admin: only their events. Include past events for stats.
        const eventsRef = collection(db, 'events');
        const eventsQuery = superAdmin
          ? query(eventsRef)
          : user
            ? query(eventsRef, where('organizer_id', '==', user.uid))
            : query(eventsRef);
        
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
        
        // Sort events: future first (nearest first), then past (most recent first)
        const now = Date.now();
        eventsData.sort((a, b) => {
          const ma = a.event_date.toMillis();
          const mb = b.event_date.toMillis();
          const aFuture = ma >= now;
          const bFuture = mb >= now;
          if (aFuture && bFuture) return ma - mb; // both future: nearest first
          if (!aFuture && !bFuture) return mb - ma; // both past: most recent first
          return aFuture ? -1 : 1; // future before past
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

  useEffect(() => {
    if (loading || loadingRecurring) return;
    const run = async () => {
      const user = getCurrentUser();
      if (!user) return;
      setDashTicketsLoading(true);
      try {
        const superAdmin = await isSuperAdmin(user.uid);
        const ids = superAdmin ? null : [...events, ...recurringEvents].map((e) => e.id);
        if (!superAdmin && (!ids || ids.length === 0)) {
          setDashTickets([]);
          return;
        }
        const since = new Date();
        since.setFullYear(since.getFullYear() - 1);
        const tix = await getTicketsSince(since, ids);
        setDashTickets(tix);
      } catch (e) {
        console.error(e);
        setDashTickets([]);
      } finally {
        setDashTicketsLoading(false);
      }
    };
    void run();
  }, [loading, loadingRecurring, events, recurringEvents]);

  const eventNameById = useMemo(() => {
    const m: Record<string, string> = {};
    [...events, ...recurringEvents].forEach((e) => {
      m[e.id] = e.name;
    });
    return m;
  }, [events, recurringEvents]);

  const formatCOP = (n: number) =>
    new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(n);

  const salesSnapshot = useMemo(() => {
    const valid = dashTickets.filter(isTicketValidForSalesStats);
    const day0 = startOfLocalDay().getTime();
    const week0 = startOfLocalWeekMonday().getTime();
    let dayRev = 0;
    let weekRev = 0;
    for (const t of valid) {
      const ms = ticketCreatedAtMs(t);
      const amt = Number(t.amount) || 0;
      if (ms >= day0) dayRev += amt;
      if (ms >= week0) weekRev += amt;
    }
    const byEvent = new Map<string, { rev: number; qty: number }>();
    for (const t of valid) {
      const cur = byEvent.get(t.eventId) || { rev: 0, qty: 0 };
      cur.rev += Number(t.amount) || 0;
      cur.qty += Number(t.quantity) || 1;
      byEvent.set(t.eventId, cur);
    }
    const top = [...byEvent.entries()]
      .map(([id, v]) => ({ id, name: eventNameById[id] || id, ...v }))
      .sort((a, b) => b.rev - a.rev)
      .slice(0, 5);

    const soldByKey = new Map<string, number>();
    for (const t of valid) {
      const secKey = (t.sectionId || t.sectionName || 'general').trim() || 'general';
      const k = `${t.eventId}::${secKey}`;
      soldByKey.set(k, (soldByKey.get(k) || 0) + (Number(t.quantity) || 1));
    }

    const soldOut: { label: string }[] = [];
    for (const ev of [...events, ...recurringEvents]) {
      const secs = ev.sections;
      if (secs && secs.length > 0) {
        for (const sec of secs) {
          const cap = Number(sec.available) || 0;
          if (cap <= 0) continue;
          const s1 = soldByKey.get(`${ev.id}::${sec.id}`) || 0;
          const s2 = sec.name ? soldByKey.get(`${ev.id}::${sec.name}`) || 0 : 0;
          const sold = Math.max(s1, s2);
          if (sold >= cap) soldOut.push({ label: `${ev.name} — ${sec.name}` });
        }
      } else {
        const cap = Number(ev.capacity_per_occurrence) || 0;
        if (cap <= 0) continue;
        const sold = valid
          .filter((t) => t.eventId === ev.id)
          .reduce((s, t) => s + (Number(t.quantity) || 1), 0);
        if (sold >= cap) soldOut.push({ label: ev.name });
      }
    }

    return { dayRev, weekRev, top, soldOut };
  }, [dashTickets, events, recurringEvents, eventNameById]);

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
        adminNavOptions={{
          showConfig: !isPartnerUser,
          showScan: !isPartnerUser || partnerScanAny,
        }}
      />

      <div className="dashboard-content">
        {(!isPartnerUser || partnerScanAny) && (
        <div className="dashboard-scan-card" onClick={() => navigate('/scan-tickets')}>
          <span className="scan-card-icon"><IconScanTickets size={32} /></span>
          <div className="scan-card-text">
            <h2>Leer Boletos</h2>
            <p>Escanear y validar entradas en taquilla</p>
          </div>
          <span className="scan-card-arrow">→</span>
        </div>
        )}

        {!isPartnerUser && (
        <section className="dashboard-sales-summary" aria-label="Resumen de ventas">
          <div className="dashboard-sales-summary__head">
            <h2 className="dashboard-sales-summary__title">Resumen rápido</h2>
          </div>
          {dashTicketsLoading ? (
            <p className="dashboard-sales-summary__muted">Cargando ventas…</p>
          ) : (
            <>
              <p className="dashboard-sales-summary__muted">
                Ventas de los últimos 12 meses. Alertas de cupo: comparación entre cupo y ventas registradas en ese periodo.
              </p>
              <div className="dashboard-sales-kpis">
                <div className="dashboard-sales-kpi">
                  <span className="dashboard-sales-kpi__value">{formatCOP(salesSnapshot.dayRev)}</span>
                  <span className="dashboard-sales-kpi__label">Ventas hoy</span>
                </div>
                <div className="dashboard-sales-kpi">
                  <span className="dashboard-sales-kpi__value">{formatCOP(salesSnapshot.weekRev)}</span>
                  <span className="dashboard-sales-kpi__label">Ventas esta semana</span>
                </div>
              </div>
              {salesSnapshot.top.length > 0 && (
                <div className="dashboard-sales-top">
                  <div className="dashboard-sales-top__head">
                    <h3>Más vendidos (por ingresos)</h3>
                    <button
                      type="button"
                      className="dashboard-sales-top__toggle"
                      onClick={() => setTopSoldExpanded((v) => !v)}
                      aria-expanded={topSoldExpanded}
                    >
                      {topSoldExpanded ? 'Ver menos' : 'Ver más'}
                    </button>
                  </div>
                  {topSoldExpanded && (
                    <ol>
                      {salesSnapshot.top.map((row) => (
                        <li key={row.id}>
                          <span className="dashboard-sales-top__name">{row.name}</span>
                          <span className="dashboard-sales-top__meta">
                            {formatCOP(row.rev)} · {row.qty} entradas
                          </span>
                        </li>
                      ))}
                    </ol>
                  )}
                </div>
              )}
              {salesSnapshot.soldOut.length > 0 && (
                <div className="dashboard-sales-alerts" role="alert">
                  <h3>Alertas de cupo</h3>
                  <ul>
                    {salesSnapshot.soldOut.map((a) => (
                      <li key={a.label}>Cupo agotado o completo: {a.label}</li>
                    ))}
                  </ul>
                </div>
              )}
            </>
          )}
        </section>
        )}

        <div className="dashboard-event-filters" aria-label="Filtros de eventos">
          <input
            type="search"
            className="dashboard-filter-input dashboard-filter-search"
            placeholder="Buscar por nombre del evento…"
            value={eventNameQuery}
            onChange={(e) => setEventNameQuery(e.target.value)}
            autoComplete="off"
          />
          <div className="dashboard-filter-dates">
            <label className="dashboard-filter-date-field">
              <span className="dashboard-filter-label">Desde</span>
              <input
                type="date"
                className="dashboard-filter-input"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
              />
            </label>
            <label className="dashboard-filter-date-field">
              <span className="dashboard-filter-label">Hasta</span>
              <input
                type="date"
                className="dashboard-filter-input"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
              />
            </label>
          </div>
          {hasActiveFilters && (
            <button type="button" className="dashboard-filter-clear" onClick={clearEventFilters}>
              Limpiar filtros
            </button>
          )}
        </div>

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
          {!isPartnerUser && (
          <div className="header-actions desktop-only">
            <PrimaryButton onClick={handleAddRecurringEvent}>
              + Recurrente
            </PrimaryButton>
          </div>
          )}
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
            ) : filteredRecurringEvents.length > 0 ? (
              <div className="events-grid">
                {filteredRecurringEvents.map((event) => (
                  <EventCard
                    key={event.id}
                    event={event}
                    onReserve={handleReserveEvent}
                    onCreateTicket={handleCreateTicket}
                    onViewTickets={(eventId) => handleViewTickets(eventId)}
                    onViewStats={handleViewStats}
                    actionMask={eventCardMaskFor(event.id)}
                  />
                ))}
              </div>
            ) : recurringEvents.length > 0 ? (
              <div className="empty-state">
                <p>Ningún evento recurrente coincide con los filtros.</p>
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
          {!isPartnerUser && (
          <div className="header-actions desktop-only">
            <PrimaryButton onClick={handleAddEvent}>
              + Evento
            </PrimaryButton>
          </div>
          )}
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
          ) : filteredEvents.length > 0 ? (
            <div className="events-grid">
              {filteredEvents.map((event) => (
                <EventCard
                  key={event.id}
                  event={event}
                  onReserve={handleReserveEvent}
                  onCreateTicket={handleCreateTicket}
                  onViewTickets={(eventId) => handleViewTickets(eventId)}
                  onViewStats={handleViewStats}
                  actionMask={eventCardMaskFor(event.id)}
                />
              ))}
            </div>
          ) : events.length > 0 ? (
            <div className="empty-state">
              <p>Ningún evento coincide con los filtros.</p>
            </div>
          ) : (
            <div className="empty-state">
              <p>No hay eventos para mostrar</p>
            </div>
          )}
        </div>
      </div>
      
      {/* Mobile fixed button */}
      {!isPartnerUser && (
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
      )}

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
