import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { collection, getDocs, query, where } from 'firebase/firestore';
import type { Timestamp } from 'firebase/firestore';
import TopNavBar from '@containers/TopNavBar';
import SecondaryButton from '@components/SecondaryButton';
import CustomInput from '@components/CustomInput';
import {
  db,
  getCurrentUser,
  isSuperAdmin,
  getExpensesByEventId,
  logoutUser,
} from '@services';
import { getTicketsByEventId } from '@services/ticketService';
import type { Ticket } from '@services/types';
import {
  IconTickets,
  IconRevenue,
  IconExpense,
  IconCalendarEvent,
} from '@components/EventStatsIcons';
import './index.scss';

interface ListedEvent {
  id: string;
  name: string;
  city: string;
  date: string;
  sortMs: number;
  isRecurring: boolean;
}

interface EventBalanceRow extends ListedEvent {
  ticketsSold: number;
  ingresos: number;
  egresos: number;
}

function validTicketsForBalance(tickets: Ticket[]): Ticket[] {
  return tickets.filter((t) => {
    const status = t.ticketStatus as string;
    const invalid =
      ['cancelled', 'disabled'].includes(status) || (t as { transferredTo?: string }).transferredTo;
    const valid = ['paid', 'reserved', 'used', 'redeemed'].includes(status);
    if ((t as { ticketKind?: string }).ticketKind === 'purchase_pass') return false;
    return valid && !invalid;
  });
}

function eventDateSortMs(data: Record<string, unknown>): number {
  const ed = data.event_date as Timestamp | undefined;
  if (ed && typeof ed.toMillis === 'function') return ed.toMillis();
  return 0;
}

async function fetchListedEvents(uid: string, superAdmin: boolean): Promise<ListedEvent[]> {
  const out: ListedEvent[] = [];
  const eventsRef = collection(db, 'events');
  const recRef = collection(db, 'recurring_events');

  if (superAdmin) {
    const [es, rs] = await Promise.all([getDocs(eventsRef), getDocs(recRef)]);
    es.forEach((d) => {
      const data = d.data();
      out.push({
        id: d.id,
        name: (data.name as string) || 'Sin nombre',
        city: (data.city as string) || '',
        date: (data.date as string) || '',
        sortMs: eventDateSortMs(data),
        isRecurring: false,
      });
    });
    rs.forEach((d) => {
      const data = d.data();
      out.push({
        id: d.id,
        name: (data.name as string) || 'Sin nombre',
        city: (data.city as string) || '',
        date: (data.date as string) || '',
        sortMs: eventDateSortMs(data),
        isRecurring: true,
      });
    });
  } else {
    const q1 = query(eventsRef, where('organizer_id', '==', uid));
    const q2 = query(recRef, where('organizer_id', '==', uid));
    const [es, rs] = await Promise.all([getDocs(q1), getDocs(q2)]);
    es.forEach((d) => {
      const data = d.data();
      out.push({
        id: d.id,
        name: (data.name as string) || 'Sin nombre',
        city: (data.city as string) || '',
        date: (data.date as string) || '',
        sortMs: eventDateSortMs(data),
        isRecurring: false,
      });
    });
    rs.forEach((d) => {
      const data = d.data();
      out.push({
        id: d.id,
        name: (data.name as string) || 'Sin nombre',
        city: (data.city as string) || '',
        date: (data.date as string) || '',
        sortMs: eventDateSortMs(data),
        isRecurring: true,
      });
    });
  }

  out.sort((a, b) => {
    if (b.sortMs !== a.sortMs) return b.sortMs - a.sortMs;
    return a.name.localeCompare(b.name, 'es');
  });
  return out;
}

async function loadBalanceRows(listed: ListedEvent[]): Promise<EventBalanceRow[]> {
  const chunkSize = 6;
  const rows: EventBalanceRow[] = [];
  for (let i = 0; i < listed.length; i += chunkSize) {
    const chunk = listed.slice(i, i + chunkSize);
    const part = await Promise.all(
      chunk.map(async (ev) => {
        try {
          const [tickets, expenses] = await Promise.all([
            getTicketsByEventId(ev.id),
            getExpensesByEventId(ev.id),
          ]);
          const valid = validTicketsForBalance(tickets);
          const ticketsSold = valid.reduce((s, t) => s + (t.quantity || 1), 0);
          const ingresos = valid.reduce((s, t) => s + (t.amount || 0), 0);
          const egresos = expenses.reduce((s, e) => s + (e.amount || 0), 0);
          return { ...ev, ticketsSold, ingresos, egresos };
        } catch {
          return { ...ev, ticketsSold: 0, ingresos: 0, egresos: 0 };
        }
      })
    );
    rows.push(...part);
  }
  return rows;
}

const BalanceScreen: React.FC = () => {
  const navigate = useNavigate();
  const [rows, setRows] = useState<EventBalanceRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [queryText, setQueryText] = useState('');

  const formatCOP = (amount: number) =>
    new Intl.NumberFormat('es-CO', {
      style: 'currency',
      currency: 'COP',
      minimumFractionDigits: 0,
    }).format(amount);

  const formatInt = (n: number) => new Intl.NumberFormat('es-CO').format(n);

  useEffect(() => {
    const run = async () => {
      const user = getCurrentUser();
      if (!user) {
        setRows([]);
        setLoading(false);
        return;
      }
      setLoading(true);
      try {
        const superA = await isSuperAdmin(user.uid);
        const listed = await fetchListedEvents(user.uid, superA);
        const data = await loadBalanceRows(listed);
        setRows(data);
      } catch {
        setRows([]);
      } finally {
        setLoading(false);
      }
    };
    void run();
  }, []);

  const filteredRows = useMemo(() => {
    const q = queryText.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((r) => {
      const name = r.name.toLowerCase();
      const city = (r.city || '').toLowerCase();
      return name.includes(q) || city.includes(q);
    });
  }, [rows, queryText]);

  if (loading) {
    return (
      <div className="balance-screen">
        <TopNavBar logoOnly showLogout onLogout={() => logoutUser()} />
        <div className="balance-content">
          <div className="balance-loading">
            <div className="balance-loading__spinner" />
            <p>Cargando balance por evento…</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="balance-screen">
      <TopNavBar logoOnly showLogout onLogout={() => logoutUser()} />
      <div className="balance-content">
        <header className="balance-hero">
          <div className="balance-hero__top">
            <div>
              <h1 className="balance-hero__title">Balance y ganancias</h1>
              <p className="balance-hero__subtitle">
                Ingresos, egresos y boletas vendidas desglosados por cada evento.
              </p>
            </div>
            <SecondaryButton onClick={() => navigate('/dashboard')} className="balance-hero__back">
              ← Volver
            </SecondaryButton>
          </div>
          {rows.length > 0 && (
            <CustomInput
              label="Buscar evento"
              value={queryText}
              onChange={(e) => setQueryText(e.target.value)}
              placeholder="Nombre o ciudad…"
            />
          )}
        </header>

        {rows.length === 0 ? (
          <div className="balance-empty">
            <IconCalendarEvent className="balance-empty__icon" />
            <p>No hay eventos para mostrar.</p>
          </div>
        ) : filteredRows.length === 0 ? (
          <div className="balance-empty">
            <p>Ningún evento coincide con la búsqueda.</p>
          </div>
        ) : (
          <ul className="balance-event-grid">
            {filteredRows.map((ev) => (
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
                        <span className="balance-event-card__place">
                          {[ev.city, ev.date].filter(Boolean).join(' · ')}
                        </span>
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
                      <span className="balance-kpi__label">Total ingresos</span>
                      <span className="balance-kpi__value">{formatCOP(ev.ingresos)}</span>
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
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
};

export default BalanceScreen;
