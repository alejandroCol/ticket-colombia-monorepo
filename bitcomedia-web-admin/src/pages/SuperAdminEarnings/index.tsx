import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { collection, getDocs } from 'firebase/firestore';
import TopNavBar from '@containers/TopNavBar';
import SecondaryButton from '@components/SecondaryButton';
import {
  db,
  logoutUser,
  getCurrentUser,
  isSuperAdmin
} from '@services';
import { getTicketsSince, isTicketValidForSalesStats } from '@services/ticketService';
import { computePlatformCommissionCOP } from '@utils/platformCommission';
import type { Event } from '@services/types';
import type { Ticket } from '@services/types';
import './index.scss';

const SINCE = new Date(2020, 0, 1);

const SuperAdminEarningsScreen: React.FC = () => {
  const navigate = useNavigate();
  const [gate, setGate] = useState<'pending' | 'yes' | 'no'>('pending');
  const [loading, setLoading] = useState(true);
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [eventsById, setEventsById] = useState<Record<string, Event>>({});

  useEffect(() => {
    const run = async () => {
      const user = getCurrentUser();
      if (!user) {
        navigate('/login', { replace: true });
        return;
      }
      const ok = await isSuperAdmin(user.uid);
      if (!ok) {
        setGate('no');
        navigate('/dashboard', { replace: true });
        return;
      }
      setGate('yes');
    };
    void run();
  }, [navigate]);

  useEffect(() => {
    if (gate !== 'yes') return;
    const load = async () => {
      setLoading(true);
      try {
        const [evSnap, recSnap, tix] = await Promise.all([
          getDocs(collection(db, 'events')),
          getDocs(collection(db, 'recurring_events')),
          getTicketsSince(SINCE, null)
        ]);
        const map: Record<string, Event> = {};
        evSnap.forEach((d) => {
          map[d.id] = { id: d.id, ...d.data() } as Event;
        });
        recSnap.forEach((d) => {
          map[d.id] = { id: d.id, ...d.data() } as Event;
        });
        setEventsById(map);
        setTickets(tix);
      } catch (e) {
        console.error(e);
        setTickets([]);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [gate]);

  const rows = useMemo(() => {
    const byEvent = new Map<string, Ticket[]>();
    for (const t of tickets) {
      if (!isTicketValidForSalesStats(t)) continue;
      const list = byEvent.get(t.eventId) || [];
      list.push(t);
      byEvent.set(t.eventId, list);
    }
    const out: {
      eventId: string;
      name: string;
      revenue: number;
      qty: number;
      commission: number;
      rule: string;
    }[] = [];
    byEvent.forEach((list, eventId) => {
      const ev = eventsById[eventId];
      const name = ev?.name || eventId;
      const revenue = list.reduce((s, x) => s + (Number(x.amount) || 0), 0);
      const qty = list.reduce((s, x) => s + (Number(x.quantity) || 1), 0);
      const commission = ev
        ? computePlatformCommissionCOP(ev, list)
        : 0;
      const t = ev?.platform_commission_type;
      const v = ev?.platform_commission_value;
      let rule = '—';
      if (t === 'percent_payer' && v != null) rule = `${v}% sobre ventas`;
      else if (t === 'fixed_per_ticket' && v != null)
        rule = `${new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(Number(v))} / boleto`;
      out.push({ eventId, name, revenue, qty, commission, rule });
    });
    out.sort((a, b) => b.commission - a.commission);
    return out;
  }, [tickets, eventsById]);

  const totalCommission = rows.reduce((s, r) => s + r.commission, 0);

  const formatCOP = (n: number) =>
    new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(n);

  if (gate === 'pending') {
    return (
      <div className="super-earnings-screen">
        <TopNavBar logoOnly showLogout onLogout={() => logoutUser()} />
        <div className="super-earnings-content">
          <p>Verificando permisos…</p>
        </div>
      </div>
    );
  }

  if (gate === 'no') return null;

  return (
    <div className="super-earnings-screen">
      <TopNavBar logoOnly showLogout onLogout={() => logoutUser()} />
      <div className="super-earnings-content">
        <div className="super-earnings-hero">
          <h1>Comisiones tiquetera por evento</h1>
          <p>Ingresos estimados según la regla configurada en cada evento (super administrador).</p>
          <SecondaryButton onClick={() => navigate('/config')}>← Volver a configuración</SecondaryButton>
        </div>
        <p className="super-earnings-hint">
          Solo se consideran boletos con estado de venta válido. El porcentaje se aplica sobre el monto cobrado
          (total de <code>amount</code> de boletos). La tarifa fija se multiplica por la cantidad de entradas vendidas.
          Datos desde 2020; ajusta reglas en el formulario de cada evento.
        </p>
        {loading ? (
          <p>Cargando…</p>
        ) : rows.length === 0 ? (
          <p>No hay ventas registradas o aún no hay eventos con comisión configurada.</p>
        ) : (
          <>
            <div className="super-earnings-table-wrap">
              <table className="super-earnings-table">
                <thead>
                  <tr>
                    <th>Evento</th>
                    <th>Regla</th>
                    <th className="super-earnings-num">Boletos</th>
                    <th className="super-earnings-num">Ventas</th>
                    <th className="super-earnings-num">Tu comisión</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r) => (
                    <tr key={r.eventId}>
                      <td>{r.name}</td>
                      <td>{r.rule}</td>
                      <td className="super-earnings-num">{r.qty}</td>
                      <td className="super-earnings-num">{formatCOP(r.revenue)}</td>
                      <td className="super-earnings-num">{formatCOP(r.commission)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="super-earnings-total">
              Total comisiones estimadas: {formatCOP(totalCommission)}
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default SuperAdminEarningsScreen;
