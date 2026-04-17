import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { collection, getDocs } from 'firebase/firestore';
import TopNavBar from '@containers/TopNavBar';
import SecondaryButton from '@components/SecondaryButton';
import {
  db,
  logoutUser,
  getCurrentUser,
  isSuperAdmin,
  getPaymentConfig,
  getOrganizerBuyerFee,
} from '@services';
import { getTicketsSince, isTicketValidForSalesStats } from '@services/ticketService';
import { computePlatformCommissionCOP } from '@utils/platformCommission';
import { aggregateEventRevenueBreakdown, normalizeGatewayCommissionConfig } from '@utils/revenueBreakdown';
import type { OrganizerBuyerFeeInput } from '@utils/revenueBreakdown';
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
  const [payoutCtx, setPayoutCtx] = useState<{
    globalFees: number;
    gateway: ReturnType<typeof normalizeGatewayCommissionConfig>;
    orgFees: Record<string, OrganizerBuyerFeeInput>;
  } | null>(null);

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

        const pay = await getPaymentConfig();
        const gateway = normalizeGatewayCommissionConfig(pay || undefined);
        const globalFees = pay?.fees ?? 9;
        const orgIds = new Set<string>();
        for (const tk of tix) {
          if (!isTicketValidForSalesStats(tk)) continue;
          const oid = String(map[tk.eventId]?.organizer_id || '').trim();
          if (oid) orgIds.add(oid);
        }
        const orgFees: Record<string, OrganizerBuyerFeeInput> = {};
        await Promise.all(
          [...orgIds].map(async (uid) => {
            const doc = await getOrganizerBuyerFee(uid);
            orgFees[uid] = doc ? { type: doc.fee_type, value: doc.fee_value } : null;
          })
        );
        setPayoutCtx({ globalFees, gateway, orgFees });
      } catch (e) {
        console.error(e);
        setTickets([]);
        setPayoutCtx(null);
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
      pasarela: number;
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
      let pasarela = 0;
      if (ev && payoutCtx) {
        const oid = String(ev.organizer_id || '').trim();
        const orgFee = payoutCtx.orgFees[oid] ?? null;
        pasarela = aggregateEventRevenueBreakdown(
          ev,
          list,
          payoutCtx.globalFees,
          orgFee,
          payoutCtx.gateway
        ).pasarelaTotal;
      }
      out.push({ eventId, name, revenue, qty, commission, rule, pasarela });
    });
    out.sort((a, b) => b.commission - a.commission);
    return out;
  }, [tickets, eventsById, payoutCtx]);

  const totalCommission = rows.reduce((s, r) => s + r.commission, 0);
  const totalPasarela = rows.reduce((s, r) => s + r.pasarela, 0);

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
          <h1>Comisiones tiquetera y pasarela por evento</h1>
          <p>
            Tarifa al comprador (tiquetera) según regla del evento; ganancia estimada de pasarela según{' '}
            <code>configurations/payments_config</code> (% + fijo + IVA). Configura la pasarela en Configuración →
            Control de plataforma.
          </p>
          <SecondaryButton onClick={() => navigate('/config')}>← Volver a configuración</SecondaryButton>
        </div>
        <p className="super-earnings-hint">
          Solo boletos con estado de venta válido. La columna tiquetera usa la vista rápida histórica (porcentaje sobre
          ventas totales o fijo × boletos). La pasarela usa el mismo modelo que el balance del organizador (subtotal de
          entradas por compra en línea; % + COP fijo por transacción + IVA). Datos desde 2020.
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
                    <th>Regla tiquetera</th>
                    <th className="super-earnings-num">Boletos</th>
                    <th className="super-earnings-num">Ventas</th>
                    <th className="super-earnings-num">Comisión tiquetera</th>
                    <th className="super-earnings-num">Ganancia pasarela</th>
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
                      <td className="super-earnings-num">{formatCOP(r.pasarela)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="super-earnings-total">
              Total comisión tiquetera (vista rápida): {formatCOP(totalCommission)}
              <br />
              Total ganancia pasarela (estimada): {formatCOP(totalPasarela)}
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default SuperAdminEarningsScreen;
