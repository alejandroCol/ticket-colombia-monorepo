import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { collection, getDocs } from 'firebase/firestore';
import { useNavigate } from 'react-router-dom';
import TopNavBar from '@containers/TopNavBar';
import SecondaryButton from '@components/SecondaryButton';
import PrimaryButton from '@components/PrimaryButton';
import CustomSelector from '@components/CustomSelector';
import CustomInput from '@components/CustomInput';
import Loader from '@components/Loader';
import {
  db,
  logoutUser,
  getCurrentUser,
  isSuperAdmin,
  getEventOrRecurringById,
  getPaymentConfig,
  getOrganizerBuyerFee,
} from '@services';
import { getTicketsByEventId } from '@services/ticketService';
import type { Event } from '@services/types';
import type { Ticket } from '@services/types';
import { normalizeGatewayCommissionConfig, type OrganizerBuyerFeeInput } from '@utils/revenueBreakdown';
import './index.scss';

type EventOpt = { id: string; label: string };

function eventOptionLabel(e: Event): string {
  const bits = [e.name || e.id, e.city, e.date].filter(Boolean);
  return bits.length ? bits.join(' · ') : e.id;
}

const SuperAdminConciliationScreen: React.FC = () => {
  const navigate = useNavigate();
  const [gate, setGate] = useState<'pending' | 'yes' | 'no'>('pending');
  const [eventOptions, setEventOptions] = useState<EventOpt[]>([]);
  const [selectedEventId, setSelectedEventId] = useState<string>('');
  const [event, setEvent] = useState<Event | null>(null);
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [ctx, setCtx] = useState<{
    globalFees: number;
    organizerFee: OrganizerBuyerFeeInput;
    gateway: ReturnType<typeof normalizeGatewayCommissionConfig>;
  } | null>(null);
  const [loadingEvents, setLoadingEvents] = useState(true);
  const [loadingEventData, setLoadingEventData] = useState(false);
  const [pdfBusy, setPdfBusy] = useState(false);

  const [excludeCourtesy, setExcludeCourtesy] = useState(false);
  const [excludeManual, setExcludeManual] = useState(false);
  const [tiqueteraSubtractStr, setTiqueteraSubtractStr] = useState('');

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
      setLoadingEvents(true);
      try {
        const [evSnap, recSnap] = await Promise.all([
          getDocs(collection(db, 'events')),
          getDocs(collection(db, 'recurring_events')),
        ]);
        const opts: EventOpt[] = [];
        evSnap.forEach((d) => {
          const data = d.data() as Event;
          opts.push({
            id: d.id,
            label: eventOptionLabel({ ...data, id: d.id }),
          });
        });
        recSnap.forEach((d) => {
          const data = d.data() as Event;
          opts.push({
            id: d.id,
            label: `${eventOptionLabel({ ...data, id: d.id })} (recurrente)`,
          });
        });
        opts.sort((a, b) => a.label.localeCompare(b.label, 'es'));
        setEventOptions(opts);
      } catch (e) {
        console.error(e);
        setEventOptions([]);
      } finally {
        setLoadingEvents(false);
      }
    };
    void load();
  }, [gate]);

  const loadEventBundle = useCallback(async (eventId: string) => {
    if (!eventId.trim()) {
      setEvent(null);
      setTickets([]);
      setCtx(null);
      return;
    }
    setLoadingEventData(true);
    try {
      const [ev, tix, pay] = await Promise.all([
        getEventOrRecurringById(eventId),
        getTicketsByEventId(eventId),
        getPaymentConfig(),
      ]);
      setEvent(ev || null);
      setTickets(tix || []);
      if (ev) {
        const orgId = String(ev.organizer_id || '').trim();
        const orgDoc = orgId ? await getOrganizerBuyerFee(orgId) : null;
        setCtx({
          globalFees: pay?.fees ?? 9,
          organizerFee: orgDoc ? { type: orgDoc.fee_type, value: orgDoc.fee_value } : null,
          gateway: normalizeGatewayCommissionConfig(pay || undefined),
        });
      } else {
        setCtx(null);
      }
    } catch (e) {
      console.error(e);
      setEvent(null);
      setTickets([]);
      setCtx(null);
    } finally {
      setLoadingEventData(false);
    }
  }, []);

  useEffect(() => {
    if (!selectedEventId) {
      setEvent(null);
      setTickets([]);
      setCtx(null);
      return;
    }
    void loadEventBundle(selectedEventId);
  }, [selectedEventId, loadEventBundle]);

  const eventName = event?.name || 'Evento';
  const canPdf = Boolean(event && ctx && !loadingEventData);

  const selectorOptions = useMemo(
    () => [{ value: '', label: 'Selecciona un evento…' }, ...eventOptions.map((o) => ({ value: o.id, label: o.label }))],
    [eventOptions]
  );

  const runPdf = async (fn: () => Promise<void>) => {
    if (!canPdf || !event || !ctx) return;
    setPdfBusy(true);
    try {
      await fn();
    } finally {
      setPdfBusy(false);
    }
  };

  const basename = (slug: string) =>
    `conciliacion-${slug}-${selectedEventId}-${new Date().toISOString().slice(0, 10)}`;

  if (gate === 'pending') {
    return (
      <div className="super-conciliation-screen">
        <TopNavBar logoOnly showLogout onLogout={() => logoutUser()} />
        <div className="super-conciliation-content">
          <p>Verificando permisos…</p>
        </div>
      </div>
    );
  }

  if (gate === 'no') return null;

  return (
    <div className="super-conciliation-screen">
      <TopNavBar logoOnly showLogout onLogout={() => logoutUser()} />
      <div className="super-conciliation-content">
        <div className="super-conciliation-hero">
          <h1>Conciliación por evento</h1>
          <p>
            Reportes en PDF para cierre contable: comisión de tiquetera, inventario de boletos y neto estimado después
            de la pasarela (según reglas guardadas en el evento y en configuración de pagos).
          </p>
          <SecondaryButton onClick={() => navigate('/config')}>← Volver a configuración</SecondaryButton>
        </div>

        <p className="super-conciliation-hint">
          Solo super administrador. Los montos de pasarela son estimados con el mismo modelo que usa el panel (subtotal de
          la entrada en compras en línea; % y fijo globales + IVA). Verifica siempre contra extractos de Mercado Pago /
          OnePay.
        </p>

        <div className="super-conciliation-event-row">
          {loadingEvents ? (
            <Loader />
          ) : (
            <CustomSelector
              name="conciliation_event"
              label="Evento"
              value={selectedEventId}
              options={selectorOptions}
              onChange={(e) => setSelectedEventId(e.target.value)}
            />
          )}
        </div>

        {selectedEventId && loadingEventData && <Loader />}

        <div className="super-conciliation-cards" aria-busy={pdfBusy}>
          <section className="super-conciliation-card">
            <h2>Reporte comisión tiquetera</h2>
            <p>
              Boletos con estado de venta válido. Suma la tarifa al comprador en línea (tiquetera) por línea. Opcionalmente
              excluye cortesías y boletos creados manualmente o taquilla.
            </p>
            <div className="super-conciliation-checks">
              <label>
                <input
                  type="checkbox"
                  checked={excludeCourtesy}
                  onChange={(e) => setExcludeCourtesy(e.target.checked)}
                />
                Excluir cortesías
              </label>
              <label>
                <input
                  type="checkbox"
                  checked={excludeManual}
                  onChange={(e) => setExcludeManual(e.target.checked)}
                />
                Excluir boletas manuales / taquilla
              </label>
            </div>
            <div className="super-conciliation-actions">
              <PrimaryButton
                type="button"
                disabled={!canPdf || pdfBusy}
                loading={pdfBusy}
                onClick={() =>
                  runPdf(async () => {
                    if (!event || !ctx) return;
                    const {
                      pdfConciliacionComisionTiquetera,
                    } = await import('@utils/eventReportsPdf');
                    await pdfConciliacionComisionTiquetera(eventName, tickets, {
                      event,
                      globalFeesPercent: ctx.globalFees,
                      organizerFee: ctx.organizerFee,
                    }, {
                      excludeCourtesy,
                      excludeManual,
                      basename: basename('comision-tiquetera'),
                    });
                  })
                }
              >
                Descargar PDF
              </PrimaryButton>
            </div>
          </section>

          <section className="super-conciliation-card">
            <h2>Reporte total de boletas</h2>
            <p>Listado de todos los documentos de boleto del evento en Firestore (todas las localidades y estados).</p>
            <div className="super-conciliation-actions">
              <PrimaryButton
                type="button"
                disabled={!canPdf || pdfBusy}
                loading={pdfBusy}
                onClick={() =>
                  runPdf(async () => {
                    const { pdfConciliacionTodasLasBoletas } = await import('@utils/eventReportsPdf');
                    await pdfConciliacionTodasLasBoletas(eventName, tickets, {
                      basename: basename('todas-boletas'),
                    });
                  })
                }
              >
                Descargar PDF
              </PrimaryButton>
            </div>
          </section>

          <section className="super-conciliation-card">
            <h2>Neto después de pasarela</h2>
            <p>
              Solo ventas con pasarela en línea. Si el evento tiene <strong>tarifa al comprador aparte</strong> (lista +
              comisión), el PDF usa el <strong>total cobrado en Mercado Pago / OnePay</strong> (ej. $100.000 + $2.000 =
              $102.000): comisión pasarela sobre ese total y neto = total menos pasarela. Si la tarifa va dentro del precio
              de lista, se mantiene el criterio anterior (subtotal de entradas). Indica abajo la <strong>suma de la
              comisión tiquetera</strong> (COP) a restar del total neto para estimar lo que queda en cuenta.
            </p>
            <div className="super-conciliation-extra-input">
              <CustomInput
                name="tiquetera_commission_subtract"
                label="Total comisión tiquetera a restar (COP)"
                type="number"
                min={0}
                value={tiqueteraSubtractStr}
                onChange={(e) => setTiqueteraSubtractStr(e.target.value)}
              />
            </div>
            <div className="super-conciliation-actions">
              <PrimaryButton
                type="button"
                disabled={!canPdf || pdfBusy}
                loading={pdfBusy}
                onClick={() =>
                  runPdf(async () => {
                    if (!event || !ctx) return;
                    const { pdfConciliacionPasarelaNeto } = await import('@utils/eventReportsPdf');
                    await pdfConciliacionPasarelaNeto(eventName, tickets, {
                      event,
                      globalFeesPercent: ctx.globalFees,
                      organizerFee: ctx.organizerFee,
                      gateway: ctx.gateway,
                    }, {
                      tiqueteraCommissionToSubtractCOP: Number(tiqueteraSubtractStr.replace(/\s/g, '')) || 0,
                      basename: basename('pasarela-neto'),
                    });
                  })
                }
              >
                Descargar PDF
              </PrimaryButton>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
};

export default SuperAdminConciliationScreen;
