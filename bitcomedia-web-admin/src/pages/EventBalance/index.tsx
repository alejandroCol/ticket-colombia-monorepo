import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import type { Timestamp } from 'firebase/firestore';
import TopNavBar from '@containers/TopNavBar';
import SecondaryButton from '@components/SecondaryButton';
import EventSubNav from '@components/EventSubNav';
import Loader from '@components/Loader';
import {
  getEventOrRecurringById,
  getCurrentUser,
  isSuperAdmin,
  hasAdminAccess,
  logoutUser,
  getPaymentConfig,
  getAnyPartnerGrantForTicketEvent,
  resolveEventCollection,
} from '@services';
import type { Event } from '@services/types';
import type { ListedEvent, EventBalanceRow } from '@utils/eventBalanceLoad';
import { loadEventBalanceRow, buildBalanceLoadContext } from '@utils/eventBalanceLoad';
import {
  IconTickets,
  IconRevenue,
  IconExpense,
  IconCalendarEvent,
} from '@components/EventStatsIcons';
import '../Balance/index.scss';

function listedEventFromDoc(ev: Event, eventId: string, isRecurring: boolean): ListedEvent {
  const ed = ev.event_date as Timestamp | undefined;
  let sortMs = 0;
  if (ed && typeof ed === 'object' && ed !== null && 'toMillis' in ed && typeof ed.toMillis === 'function') {
    sortMs = ed.toMillis();
  }
  return {
    id: eventId,
    name: ev.name || 'Sin nombre',
    city: ev.city || '',
    date: ev.date || '',
    sortMs,
    isRecurring,
    organizer_id: String(ev.organizer_id || ''),
  };
}

const EventBalanceScreen: React.FC = () => {
  const navigate = useNavigate();
  const { eventId } = useParams<{ eventId: string }>();
  const [event, setEvent] = useState<Event | null>(null);
  const [row, setRow] = useState<EventBalanceRow | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [eventCollection, setEventCollection] = useState<'events' | 'recurring_events' | null>(null);
  const [showOrganizerExtras, setShowOrganizerExtras] = useState(false);

  const formatCOP = (amount: number) =>
    new Intl.NumberFormat('es-CO', {
      style: 'currency',
      currency: 'COP',
      minimumFractionDigits: 0,
    }).format(amount);

  const formatInt = (n: number) => new Intl.NumberFormat('es-CO').format(n);

  const loadData = useCallback(async () => {
    if (!eventId) return;
    try {
      setLoading(true);
      setError(null);
      const [eventData, coll] = await Promise.all([
        getEventOrRecurringById(eventId),
        resolveEventCollection(eventId),
      ]);
      setEvent(eventData || null);
      setEventCollection(coll);
      if (!eventData) {
        setRow(null);
        return;
      }
      const isRecurring = coll === 'recurring_events';
      const listed = listedEventFromDoc(eventData, eventId, isRecurring);
      const pay = await getPaymentConfig();
      const ctx = buildBalanceLoadContext(pay);
      const data = await loadEventBalanceRow(listed, ctx);
      setRow(data);
    } catch {
      setError('No se pudo cargar el balance del evento.');
      setRow(null);
    } finally {
      setLoading(false);
    }
  }, [eventId]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  useEffect(() => {
    if (loading || !event || !eventId) return;
    const check = async () => {
      const user = getCurrentUser();
      if (!user) return;
      setShowOrganizerExtras(false);
      const superA = await isSuperAdmin(user.uid);
      if (superA) {
        setShowOrganizerExtras(true);
        return;
      }
      if (event.organizer_id === user.uid) {
        setShowOrganizerExtras(true);
        return;
      }
      const admin = await hasAdminAccess(user.uid);
      if (admin) {
        navigate('/dashboard', { replace: true });
        return;
      }
      const pair = await getAnyPartnerGrantForTicketEvent(user.uid, eventId);
      if (pair?.grant.permissions.view_stats) {
        navigate('/dashboard', { replace: true });
        return;
      }
      navigate('/dashboard', { replace: true });
    };
    void check();
  }, [event, eventId, loading, navigate]);

  if (loading) {
    return (
      <div className="balance-screen">
        <TopNavBar logoOnly showLogout onLogout={() => logoutUser()} />
        <div className="balance-content balance-content--centered">
          <Loader />
          <p className="balance-loading-text">Cargando balance…</p>
        </div>
      </div>
    );
  }

  if (error || !event || !eventId || !row) {
    return (
      <div className="balance-screen">
        <TopNavBar logoOnly showLogout onLogout={() => logoutUser()} />
        <div className="balance-content">
          <p>{error || 'Evento no encontrado'}</p>
          <SecondaryButton onClick={() => navigate('/dashboard')}>Volver</SecondaryButton>
        </div>
      </div>
    );
  }

  const ev = row;

  return (
    <div className="balance-screen">
      <TopNavBar logoOnly showLogout onLogout={() => logoutUser()} />
      {eventCollection && (
        <EventSubNav
          eventId={eventId}
          eventTitle={event.name}
          isRecurring={eventCollection === 'recurring_events'}
          active="balance"
          showOrganizerExtras={showOrganizerExtras}
        />
      )}
      <div className="balance-content balance-content--event-full">
        <header className="balance-hero">
          <div className="balance-hero__top">
            <div>
              <h1 className="balance-hero__title">Balance del evento</h1>
              <p className="balance-hero__subtitle">
                Ingresos netos estimados y egresos. Misma lógica que en Balance global.
              </p>
            </div>
            <SecondaryButton onClick={() => navigate('/balance')} className="balance-hero__back">
              Ver todos
            </SecondaryButton>
          </div>
        </header>

        <ul className="balance-event-grid">
          <li key={`${ev.isRecurring ? 'r' : 'e'}-${ev.id}`} className="balance-event-card">
            <div className="balance-event-card__head">
              <div className="balance-event-card__head-icon" aria-hidden>
                <IconCalendarEvent />
              </div>
              <div className="balance-event-card__head-text">
                <h2 className="balance-event-card__title">{ev.name}</h2>
                <div className="balance-event-card__meta">
                  {ev.isRecurring && <span className="balance-event-card__badge">Recurrente</span>}
                  {(ev.city || ev.date) && (
                    <span className="balance-event-card__place">{[ev.city, ev.date].filter(Boolean).join(' · ')}</span>
                  )}
                </div>
              </div>
              <button
                type="button"
                className="balance-event-card__stats-link"
                onClick={() => navigate(`/events/${ev.id}/stats`)}
              >
                Estadísticas
              </button>
            </div>

            <div className="balance-event-card__kpis">
              <div className="balance-kpi balance-kpi--tickets">
                <div className="balance-kpi__icon" aria-hidden>
                  <IconTickets />
                </div>
                <div className="balance-kpi__body">
                  <span className="balance-kpi__label">Boletas vendidas</span>
                  <span className="balance-kpi__value">{formatInt(ev.ticketsSold)}</span>
                </div>
              </div>
              <div className="balance-kpi balance-kpi--income">
                <div className="balance-kpi__icon" aria-hidden>
                  <IconRevenue />
                </div>
                <div className="balance-kpi__body">
                  <span className="balance-kpi__label">Total ingresos (neto estimado)</span>
                  <span className="balance-kpi__value">{formatCOP(ev.netoOrganizador)}</span>
                </div>
              </div>
              <div className="balance-kpi balance-kpi--expense">
                <div className="balance-kpi__icon" aria-hidden>
                  <IconExpense />
                </div>
                <div className="balance-kpi__body">
                  <span className="balance-kpi__label">Total egresos</span>
                  <span className="balance-kpi__value">{formatCOP(ev.egresos)}</span>
                </div>
              </div>
              <div className="balance-money-breakdown" aria-label="Desglose de dinero">
                <div className="balance-money-breakdown__row">
                  <span>Subtotal entradas (sin tarifa servicio)</span>
                  <span>{formatCOP(ev.subtotalEntradas)}</span>
                </div>
                <div className="balance-money-breakdown__row balance-money-breakdown__row--muted">
                  <span>Tarifa servicio tiquetera</span>
                  <span>{formatCOP(ev.tiqueteraFee)}</span>
                </div>
                <div className="balance-money-breakdown__row balance-money-breakdown__row--accent">
                  <span>Comisión pasarela (estimada)</span>
                  <span>−{formatCOP(ev.pasarelaTotal)}</span>
                </div>
                <div className="balance-money-breakdown__sub">
                  <span>% variable</span>
                  <span>{formatCOP(ev.pasarelaPct)}</span>
                </div>
                <div className="balance-money-breakdown__sub">
                  <span>Valor fijo (por transacción)</span>
                  <span>{formatCOP(ev.pasarelaFixed)}</span>
                </div>
                <div className="balance-money-breakdown__sub">
                  <span>IVA sobre base pasarela</span>
                  <span>{formatCOP(ev.pasarelaIva)}</span>
                </div>
                <p className="balance-money-breakdown__hint">
                  El total cobrado al comprador es subtotal + tarifa tiquetera (desglose arriba). El neto resta la
                  comisión de pasarela (estimada, solo ventas en línea) del subtotal de entradas.
                </p>
              </div>
            </div>
          </li>
        </ul>
      </div>
    </div>
  );
};

export default EventBalanceScreen;
