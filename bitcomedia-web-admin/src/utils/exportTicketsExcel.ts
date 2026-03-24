import * as XLSX from 'xlsx';
import type { Ticket } from '@services/types';
import type { Timestamp } from 'firebase/firestore';

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

export function exportTicketsToExcel(
  tickets: Ticket[],
  eventNames: Record<string, string>,
  filename = 'boletos-export'
): void {
  const rows = tickets.map((t) => ({
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
    pago: t.paymentStatus || t.status || ''
  }));
  const ws = XLSX.utils.json_to_sheet(rows);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Boletos');
  XLSX.writeFile(wb, `${filename}.xlsx`);
}
