import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import TopNavBar from '@containers/TopNavBar';
import PrimaryButton from '@components/PrimaryButton';
import SecondaryButton from '@components/SecondaryButton';
import CustomInput from '@components/CustomInput';
import CustomSelector from '@components/CustomSelector';
import EventSubNav from '@components/EventSubNav';
import Loader from '@components/Loader';
import {
  getEventOrRecurringById,
  getCurrentUser,
  isSuperAdmin,
  hasAdminAccess,
  logoutUser,
  getExpensesByEventId,
  getAnyPartnerGrantForTicketEvent,
  resolveEventCollection,
  getPaymentConfig,
  getOrganizerBuyerFee,
} from '@services';
import { normalizeGatewayCommissionConfig } from '@utils/revenueBreakdown';
import type { PdfVentasMoneyContext } from '@utils/eventReportsPdf';
import { getTicketsByEventId } from '@services/ticketService';
import type { Event, EventSection } from '@services/types';
import type { Ticket } from '@services/types';
import type { Expense } from '@services/firestore';
import {
  validTicketsForReportSales,
  isCourtesyTicket,
  parseYmdLocal,
  dayStartMs,
  dayEndMs,
  todayRangeMs,
} from '@utils/eventReportFilters';
import { ticketCreatedAtMs } from '@services/ticketService';
import './index.scss';

function defaultDateRange(): { from: string; to: string } {
  const t = new Date();
  const y = t.getFullYear();
  const m = String(t.getMonth() + 1).padStart(2, '0');
  const d = String(t.getDate()).padStart(2, '0');
  return { from: `${y}-${m}-01`, to: `${y}-${m}-${d}` };
}

const EventReportsScreen: React.FC = () => {
  const navigate = useNavigate();
  const { eventId } = useParams<{ eventId: string }>();
  const [event, setEvent] = useState<Event | null>(null);
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [eventCollection, setEventCollection] = useState<'events' | 'recurring_events' | null>(null);
  const [showOrganizerExtras, setShowOrganizerExtras] = useState(false);
  const [pdfBusy, setPdfBusy] = useState(false);

  const [periodFrom, setPeriodFrom] = useState(defaultDateRange().from);
  const [periodTo, setPeriodTo] = useState(defaultDateRange().to);
  const [egresoFrom, setEgresoFrom] = useState(defaultDateRange().from);
  const [egresoTo, setEgresoTo] = useState(defaultDateRange().to);
  const [locFrom, setLocFrom] = useState(defaultDateRange().from);
  const [locTo, setLocTo] = useState(defaultDateRange().to);
  const [compradoresFrom, setCompradoresFrom] = useState(defaultDateRange().from);
  const [compradoresTo, setCompradoresTo] = useState(defaultDateRange().to);
  const [sectionId, setSectionId] = useState<string>('');
  const [pdfMoney, setPdfMoney] = useState<PdfVentasMoneyContext | null>(null);

  const loadData = useCallback(async () => {
    if (!eventId) return;
    try {
      setLoading(true);
      setError(null);
      const [eventData, ticketsData, expensesData, coll, pay] = await Promise.all([
        getEventOrRecurringById(eventId),
        getTicketsByEventId(eventId),
        getExpensesByEventId(eventId),
        resolveEventCollection(eventId),
        getPaymentConfig(),
      ]);
      setEvent(eventData || null);
      setTickets(ticketsData || []);
      setExpenses(expensesData || []);
      setEventCollection(coll);
      if (eventData) {
        const orgId = String(eventData.organizer_id || '').trim();
        const orgDoc = orgId ? await getOrganizerBuyerFee(orgId) : null;
        setPdfMoney({
          event: eventData,
          globalFeesPercent: pay?.fees ?? 9,
          organizerFee: orgDoc ? { type: orgDoc.fee_type, value: orgDoc.fee_value } : null,
          gateway: normalizeGatewayCommissionConfig(pay || undefined),
        });
      } else {
        setPdfMoney(null);
      }
    } catch {
      setError('No se pudieron cargar los datos del evento.');
      setPdfMoney(null);
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
      if (pair?.grant.permissions.view_stats) return;
      navigate('/dashboard', { replace: true });
    };
    void check();
  }, [event, eventId, loading, navigate]);

  const eventName = event?.name || 'Evento';

  const sections: EventSection[] = event?.sections || [];
  const sectionOptions = useMemo(
    () => [
      { value: '', label: 'Todas las localidades' },
      ...sections.map((s) => ({ value: s.id, label: s.name || s.id })),
    ],
    [sections]
  );

  const salesPool = useMemo(() => tickets.filter(validTicketsForReportSales), [tickets]);

  const runPdf = async (fn: () => Promise<void>) => {
    setPdfBusy(true);
    try {
      await fn();
    } catch (e) {
      console.error(e);
      alert(e instanceof Error ? e.message : 'No se pudo generar el PDF.');
    } finally {
      setPdfBusy(false);
    }
  };

  const handleVentasHoy = () =>
    runPdf(async () => {
      if (!pdfMoney) {
        alert('No se pudo cargar la configuración de pagos del evento.');
        return;
      }
      const { pdfVentas } = await import('@utils/eventReportsPdf');
      const { start, end } = todayRangeMs();
      const list = salesPool.filter((t) => {
        const ms = ticketCreatedAtMs(t);
        return ms >= start && ms <= end;
      });
      await pdfVentas(eventName, list, {
        title: 'Reporte de ventas',
        periodLabel: `Ventas del día · ${new Date().toLocaleDateString('es-CO')}`,
        basename: `ventas-hoy-${eventId}`,
        money: pdfMoney,
      });
    });

  const handleVentasPeriodo = () =>
    runPdf(async () => {
      const { pdfVentas } = await import('@utils/eventReportsPdf');
      const a = dayStartMs(parseYmdLocal(periodFrom));
      const b = dayEndMs(parseYmdLocal(periodTo));
      if (a > b) {
        alert('La fecha inicial no puede ser posterior a la final.');
        return;
      }
      const list = salesPool.filter((t) => {
        const ms = ticketCreatedAtMs(t);
        return ms >= a && ms <= b;
      });
      if (!pdfMoney) {
        alert('No se pudo cargar la configuración de pagos del evento.');
        return;
      }
      await pdfVentas(eventName, list, {
        title: 'Reporte de ventas',
        periodLabel: `Periodo: ${periodFrom} → ${periodTo}`,
        basename: `ventas-${periodFrom}-${periodTo}-${eventId}`,
        money: pdfMoney,
      });
    });

  const handleEgresosTodos = () =>
    runPdf(async () => {
      const { pdfEgresos } = await import('@utils/eventReportsPdf');
      await pdfEgresos(eventName, expenses, {
        periodLabel: 'Todos los egresos registrados',
        basename: `egresos-todos-${eventId}`,
      });
    });

  const handleEgresosPeriodo = () =>
    runPdf(async () => {
      const { pdfEgresosEnPeriodo } = await import('@utils/eventReportsPdf');
      const a = egresoFrom.replace(/-/g, '');
      const b = egresoTo.replace(/-/g, '');
      if (a > b) {
        alert('La fecha inicial no puede ser posterior a la final.');
        return;
      }
      await pdfEgresosEnPeriodo(eventName, expenses, {
        from: egresoFrom,
        to: egresoTo,
        basename: `egresos-${egresoFrom}-${egresoTo}-${eventId}`,
      });
    });

  const handleCortesias = () =>
    runPdf(async () => {
      const { pdfCortesias } = await import('@utils/eventReportsPdf');
      const list = tickets.filter(
        (t) =>
          isCourtesyTicket(t) &&
          !['cancelled', 'disabled'].includes(String(t.ticketStatus)) &&
            !(t as { transferredTo?: string }).transferredTo
      );
      await pdfCortesias(eventName, list, {
        periodLabel: 'Todas las cortesías del evento',
        basename: `cortesias-${eventId}`,
      });
    });

  const handleCompradores = () =>
    runPdf(async () => {
      const { pdfCompradores } = await import('@utils/eventReportsPdf');
      const a = dayStartMs(parseYmdLocal(compradoresFrom));
      const b = dayEndMs(parseYmdLocal(compradoresTo));
      if (a > b) {
        alert('La fecha inicial no puede ser posterior a la final.');
        return;
      }
      const list = salesPool
        .filter((t) => !isCourtesyTicket(t))
        .filter((t) => {
          const ms = ticketCreatedAtMs(t);
          return ms >= a && ms <= b;
        })
        .sort((x, y) => ticketCreatedAtMs(x) - ticketCreatedAtMs(y));
      await pdfCompradores(eventName, list, {
        periodLabel: `Compras con ingreso (sin cortesías): ${compradoresFrom} → ${compradoresTo}`,
        basename: `compradores-${compradoresFrom}-${compradoresTo}-${eventId}`,
      });
    });

  const handlePorLocalidad = () =>
    runPdf(async () => {
      if (!pdfMoney) {
        alert('No se pudo cargar la configuración de pagos del evento.');
        return;
      }
      const { pdfVentasFiltradas } = await import('@utils/eventReportsPdf');
      const a = dayStartMs(parseYmdLocal(locFrom));
      const b = dayEndMs(parseYmdLocal(locTo));
      if (a > b) {
        alert('La fecha inicial no puede ser posterior a la final.');
        return;
      }
      let list = salesPool.filter((t) => {
        const ms = ticketCreatedAtMs(t);
        return ms >= a && ms <= b;
      });
      if (sectionId) {
        const sec = sections.find((s) => s.id === sectionId);
        list = list.filter(
          (t) => t.sectionId === sectionId || (sec && t.sectionName === sec.name)
        );
      }
      const sectionLabel =
        sectionId ? sections.find((s) => s.id === sectionId)?.name || sectionId : 'Todas';
      await pdfVentasFiltradas(eventName, list, {
        periodLabel: `${locFrom} → ${locTo}`,
        basename: `entradas-${sectionLabel}-${locFrom}-${locTo}-${eventId}`,
        sectionLabel,
        money: pdfMoney,
      });
    });

  if (loading) {
    return (
      <div className="event-reports-screen">
        <TopNavBar logoOnly showLogout onLogout={() => logoutUser()} />
        <div className="event-reports-content event-reports-content--center">
          <Loader />
          <p className="event-reports-muted">Cargando reportes…</p>
        </div>
      </div>
    );
  }

  if (error || !event || !eventId) {
    return (
      <div className="event-reports-screen">
        <TopNavBar logoOnly showLogout onLogout={() => logoutUser()} />
        <div className="event-reports-content">
          <p>{error || 'Evento no encontrado'}</p>
          <SecondaryButton onClick={() => navigate('/dashboard')}>Volver</SecondaryButton>
        </div>
      </div>
    );
  }

  return (
    <div className="event-reports-screen">
      <TopNavBar logoOnly showLogout onLogout={() => logoutUser()} />
      {eventCollection && (
        <EventSubNav
          eventId={eventId}
          eventTitle={event.name}
          isRecurring={eventCollection === 'recurring_events'}
          active="reports"
          showOrganizerExtras={showOrganizerExtras}
        />
      )}
      <div className="event-reports-content">
        <header className="event-reports-hero">
          <h1 className="event-reports-hero__title">Reportes PDF</h1>
          <p className="event-reports-hero__subtitle">
            Genera informes con el logo de Ticket Colombia. En ventas y entradas por localidad, la columna de monto es{' '}
            <strong>neta</strong>, después de deducciones de tiquetera y pasarela de pagos. Los egresos siguen en valor
            registrado.
          </p>
        </header>

        {pdfBusy && (
          <div className="event-reports-busy" role="status">
            <Loader />
            <span>Generando PDF…</span>
          </div>
        )}

        <div className="event-reports-grid">
          <section className="event-reports-card">
            <h2 className="event-reports-card__title">Ventas hoy</h2>
            <p className="event-reports-card__desc">Boletos vendidos hoy (fecha local) con estado válido.</p>
            <PrimaryButton type="button" disabled={pdfBusy || !pdfMoney} onClick={() => void handleVentasHoy()}>
              Generar PDF
            </PrimaryButton>
          </section>

          <section className="event-reports-card event-reports-card--wide">
            <h2 className="event-reports-card__title">Compradores (datos de contacto)</h2>
            <p className="event-reports-card__desc">
              Listado demográfico para gestión del evento: nombre, correo, teléfono, documento, localidad y método de pago.
              Incluye solo compras con ingreso (excluye cortesías). Ajusta el rango de fechas para cubrir todo el historial
              del evento si lo necesitas.
            </p>
            <div className="event-reports-card__fields">
              <CustomInput
                type="date"
                label="Desde"
                value={compradoresFrom}
                onChange={(e) => setCompradoresFrom(e.target.value)}
              />
              <CustomInput
                type="date"
                label="Hasta"
                value={compradoresTo}
                onChange={(e) => setCompradoresTo(e.target.value)}
              />
            </div>
            <PrimaryButton type="button" disabled={pdfBusy} onClick={() => void handleCompradores()}>
              Generar PDF
            </PrimaryButton>
          </section>

          <section className="event-reports-card">
            <h2 className="event-reports-card__title">Ventas por periodo</h2>
            <p className="event-reports-card__desc">Filtra por rango de fechas de creación del boleto.</p>
            <div className="event-reports-card__fields">
              <CustomInput
                type="date"
                label="Desde"
                value={periodFrom}
                onChange={(e) => setPeriodFrom(e.target.value)}
              />
              <CustomInput
                type="date"
                label="Hasta"
                value={periodTo}
                onChange={(e) => setPeriodTo(e.target.value)}
              />
            </div>
            <PrimaryButton type="button" disabled={pdfBusy || !pdfMoney} onClick={() => void handleVentasPeriodo()}>
              Generar PDF
            </PrimaryButton>
          </section>

          <section className="event-reports-card">
            <h2 className="event-reports-card__title">Egresos (completo)</h2>
            <p className="event-reports-card__desc">Listado de todos los egresos del evento.</p>
            <PrimaryButton type="button" disabled={pdfBusy} onClick={() => void handleEgresosTodos()}>
              Generar PDF
            </PrimaryButton>
          </section>

          <section className="event-reports-card">
            <h2 className="event-reports-card__title">Egresos por periodo</h2>
            <p className="event-reports-card__desc">Según la fecha registrada en cada egreso (YYYY-MM-DD).</p>
            <div className="event-reports-card__fields">
              <CustomInput
                type="date"
                label="Desde"
                value={egresoFrom}
                onChange={(e) => setEgresoFrom(e.target.value)}
              />
              <CustomInput
                type="date"
                label="Hasta"
                value={egresoTo}
                onChange={(e) => setEgresoTo(e.target.value)}
              />
            </div>
            <PrimaryButton type="button" disabled={pdfBusy} onClick={() => void handleEgresosPeriodo()}>
              Generar PDF
            </PrimaryButton>
          </section>

          <section className="event-reports-card">
            <h2 className="event-reports-card__title">Cortesías</h2>
            <p className="event-reports-card__desc">Entradas marcadas como cortesía (incluye cortesías generales).</p>
            <PrimaryButton type="button" disabled={pdfBusy} onClick={() => void handleCortesias()}>
              Generar PDF
            </PrimaryButton>
          </section>

          <section className="event-reports-card event-reports-card--wide">
            <h2 className="event-reports-card__title">Entradas por localidad y fecha</h2>
            <p className="event-reports-card__desc">
              Combina localidad (opcional) y rango de fechas sobre ventas válidas.
            </p>
            <div className="event-reports-card__fields">
              <CustomSelector
                label="Localidad"
                name="section"
                value={sectionId}
                options={sectionOptions}
                onChange={(e) => setSectionId(e.target.value)}
              />
              <CustomInput type="date" label="Desde" value={locFrom} onChange={(e) => setLocFrom(e.target.value)} />
              <CustomInput type="date" label="Hasta" value={locTo} onChange={(e) => setLocTo(e.target.value)} />
            </div>
            <PrimaryButton type="button" disabled={pdfBusy || !pdfMoney} onClick={() => void handlePorLocalidad()}>
              Generar PDF
            </PrimaryButton>
          </section>
        </div>
      </div>
    </div>
  );
};

export default EventReportsScreen;
