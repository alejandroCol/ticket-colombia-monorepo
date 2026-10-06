import * as XLSX from 'xlsx';
import type { Ticket } from '@services/types';
import type { Timestamp } from 'firebase/firestore';
import { ticketOnlineGatewayProvider, ticketPaymentChannelLabel } from '@utils/salesChannelBreakdown';

function tsToIso(ts: Timestamp | Date | null | undefined): string {
  if (!ts) return '';
  try {
    if (ts instanceof Date) return ts.toISOString();
    if (typeof (ts as Timestamp).toDate === 'function') return (ts as Timestamp).toDate().toISOString();
  } catch {
    /* ignore */
  }
  return String(ts);
}

export type TicketExcelSheet = 'onepay' | 'mercadopago' | 'manual';

/** Hoja del Excel según canal de cobro (misma lógica que balance / reportes). */
export function ticketExcelSheetChannel(t: Ticket): TicketExcelSheet {
  const provider = ticketOnlineGatewayProvider(t);
  if (provider === 'onepay') return 'onepay';
  if (provider === 'mercadopago') return 'mercadopago';
  return 'manual';
}

type ExportRow = {
  id: string;
  eventId: string;
  evento: string;
  creado: string;
  email: string;
  nombre: string;
  cedula: string;
  localidad: string;
  cantidad: number;
  monto: number;
  moneda: string;
  estado: string;
  pago: string;
  canal: string;
};

const EXPORT_HEADERS: (keyof ExportRow)[] = [
  'id',
  'eventId',
  'evento',
  'creado',
  'email',
  'nombre',
  'cedula',
  'localidad',
  'cantidad',
  'monto',
  'moneda',
  'estado',
  'pago',
  'canal',
];

function ticketToExportRow(t: Ticket, eventNames: Record<string, string>): ExportRow {
  return {
    id: t.id,
    eventId: t.eventId,
    evento: eventNames[t.eventId] || t.eventId,
    creado: tsToIso(t.createdAt),
    email: t.buyerEmail || '',
    nombre: t.buyerName || t.metadata?.userName || '',
    cedula: t.buyerIdNumber || '',
    localidad: t.sectionName || '',
    cantidad: t.quantity ?? 1,
    monto: t.amount ?? 0,
    moneda: t.currency || 'COP',
    estado: t.ticketStatus || '',
    pago: t.paymentStatus || t.status || '',
    canal: ticketPaymentChannelLabel(t),
  };
}

const SHEET_CONFIG: { key: TicketExcelSheet; name: string }[] = [
  { key: 'onepay', name: 'OnePay' },
  { key: 'mercadopago', name: 'Mercado Pago' },
  { key: 'manual', name: 'Manual' },
];

function appendSheet(wb: XLSX.WorkBook, name: string, rows: ExportRow[]) {
  const ws =
    rows.length > 0
      ? XLSX.utils.json_to_sheet(rows)
      : XLSX.utils.aoa_to_sheet([EXPORT_HEADERS as string[]]);
  XLSX.utils.book_append_sheet(wb, ws, name);
}

export function exportTicketsToExcel(
  tickets: Ticket[],
  eventNames: Record<string, string>,
  filename = 'boletos-export'
): void {
  const bySheet: Record<TicketExcelSheet, ExportRow[]> = {
    onepay: [],
    mercadopago: [],
    manual: [],
  };
  for (const t of tickets) {
    bySheet[ticketExcelSheetChannel(t)].push(ticketToExportRow(t, eventNames));
  }

  const wb = XLSX.utils.book_new();
  for (const { key, name } of SHEET_CONFIG) {
    appendSheet(wb, name, bySheet[key]);
  }
  XLSX.writeFile(wb, `${filename}.xlsx`);
}
