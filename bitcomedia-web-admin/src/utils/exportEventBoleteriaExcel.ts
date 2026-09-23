import * as XLSX from 'xlsx';
import type { Timestamp } from 'firebase/firestore';
import type { Ticket, VenueMapConfig } from '@services/types';
import { ticketCreatedAtMs } from '@services/ticketService';
import {
  isAdminTicketRowVisible,
  isTicketCourtesyRow,
  ticketDocUnits,
  ticketListBuyerIdNumber,
  ticketListBuyerName,
  ticketListBuyerPhone,
  ticketLineAmountCOP,
  buildParentBundleInfoMap,
  ticketPerBoletoAmountCOP,
} from '@utils/ticketListDisplay';
import {
  resolveTicketLocality,
  isTicketAbonoRow,
  isTicketAbonoCompleted,
  isTicketCheckoutHold,
} from '@utils/ticketDisplay';

export interface BoleteriaTicketRecord {
  id: string;
  validado: string;
  fechaValidacion: string;
  localidad: string;
  cedula: string;
  nombre: string;
  email: string;
  telefono: string;
  precioBoletoCOP: number | string;
  esCortesia: string;
  cortesiaDetalle: string;
  cantidad: number;
  montoTotalCOP: number;
  estado: string;
  metodoPago: string;
  fechaCreacion: string;
  tipoReserva: string;
  faseAbono: string;
}

function tsToLocalString(ts: Timestamp | Date | null | undefined): string {
  if (!ts) return '';
  try {
    const date =
      ts instanceof Date
        ? ts
        : typeof (ts as Timestamp).toDate === 'function'
          ? (ts as Timestamp).toDate()
          : null;
    if (!date) return '';
    return date.toLocaleString('es-CO', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return '';
  }
}

function eventFilenameSlug(name: string): string {
  return (
    name
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^\w\s-]+/g, '')
      .trim()
      .replace(/\s+/g, '-')
      .slice(0, 48) || 'evento'
  );
}

function ticketStatusLabel(status?: string): string {
  const map: Record<string, string> = {
    approved: 'Aprobado',
    pending: 'Pendiente',
    reserved: 'Reservado',
    paid: 'Pagado',
    cancelled: 'Cancelado',
    disabled: 'Deshabilitado',
    used: 'Usado',
    redeemed: 'Validado',
  };
  return map[status || ''] || status || '—';
}

function paymentMethodLabel(method?: string, createdByAdmin?: string): string {
  if (method === 'manual' || method === 'admin_manual' || createdByAdmin) return 'Manual';
  if (method?.toLowerCase().includes('mercadopago')) return 'MercadoPago';
  return method || '—';
}

function abonoPhaseLabel(phase?: string): string {
  const map: Record<string, string> = {
    awaiting_deposit: 'Esperando abono inicial',
    deposit_paid: 'Abono pagado — saldo pendiente',
    awaiting_balance: 'Pago de saldo en curso',
    completed: 'Abono completado',
    forfeited: 'Abono perdido',
  };
  return map[phase || ''] || '';
}

function reservationTypeLabel(t: Ticket): string {
  if (isTicketCheckoutHold(t)) return 'Reserva sin pago';
  if (isTicketAbonoRow(t)) return 'Abono';
  if (isTicketAbonoCompleted(t)) return 'Abono completado';
  return 'Confirmado';
}

function courtesyDetail(t: Ticket & { isGeneralCourtesy?: boolean; giftedBy?: string | null }): string {
  if (!isTicketCourtesyRow(t)) return '';
  if (t.isGeneralCourtesy) return 'Evento general';
  if (t.giftedBy) return `Por: ${t.giftedBy}`;
  return 'Cortesía';
}

/** Boletos elegibles para el reporte de boletería (una fila por entrada/QR visible en admin). */
export function ticketsForBoleteriaExport(tickets: Ticket[]): Ticket[] {
  return tickets.filter((t) => isAdminTicketRowVisible(t as { ticketKind?: string }));
}

function buildBoleteriaRecord(
  t: Ticket,
  venueMap: VenueMapConfig | null | undefined,
  parentBundleMap: ReturnType<typeof buildParentBundleInfoMap>
): BoleteriaTicketRecord {
  const locality = resolveTicketLocality(t, venueMap);
  const courtesy = isTicketCourtesyRow(t);

  return {
    id: t.id,
    validado: t.validatedAt ? 'Sí' : 'No',
    fechaValidacion: tsToLocalString(t.validatedAt),
    localidad: locality.displayLine,
    cedula: ticketListBuyerIdNumber(t),
    nombre: ticketListBuyerName(t),
    email: (t.buyerEmail || '').trim(),
    telefono: ticketListBuyerPhone(t),
    precioBoletoCOP: courtesy
      ? 'Cortesía'
      : ticketPerBoletoAmountCOP(t, parentBundleMap),
    esCortesia: courtesy ? 'Sí' : 'No',
    cortesiaDetalle: courtesyDetail(t),
    cantidad: ticketDocUnits(t),
    montoTotalCOP: courtesy ? 0 : ticketLineAmountCOP(t),
    estado: ticketStatusLabel(t.ticketStatus || t.status),
    metodoPago: paymentMethodLabel(t.paymentMethod, t.createdByAdmin),
    fechaCreacion: tsToLocalString(t.createdAt),
    tipoReserva: reservationTypeLabel(t),
    faseAbono: abonoPhaseLabel(t.installmentPhase),
  };
}

/** Construye filas del reporte de boletería ordenadas por fecha de creación (más reciente primero). */
export function extractBoleteriaTicketRows(
  tickets: Ticket[],
  venueMap?: VenueMapConfig | null
): BoleteriaTicketRecord[] {
  const eligible = ticketsForBoleteriaExport(tickets);
  const parentBundleMap = buildParentBundleInfoMap(tickets);

  return eligible
    .sort((a, b) => ticketCreatedAtMs(b) - ticketCreatedAtMs(a))
    .map((t) => buildBoleteriaRecord(t, venueMap, parentBundleMap));
}

export function exportEventBoleteriaToExcel(
  tickets: Ticket[],
  eventName: string,
  venueMap?: VenueMapConfig | null,
  filename?: string
): number {
  const rows = extractBoleteriaTicketRows(tickets, venueMap);
  const ws = XLSX.utils.json_to_sheet(rows);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Boletería');
  const stamp = new Date().toISOString().slice(0, 10);
  const slug = eventFilenameSlug(eventName);
  XLSX.writeFile(wb, `${filename ?? `boleteria-${slug}-${stamp}`}.xlsx`);
  return rows.length;
}
