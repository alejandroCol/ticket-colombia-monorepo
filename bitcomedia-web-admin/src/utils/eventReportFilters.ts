import type { EventSection, Ticket } from '@services/types';
import { isTicketValidForSalesStats } from '@services/ticketService';

/** Nombres repetidos en el evento (empatar solo por nombre duplicaría boletos). */
export function duplicateSectionNames(sections: Pick<EventSection, 'name'>[]): Set<string> {
  const counts = new Map<string, number>();
  for (const sec of sections) {
    const n = String(sec.name || '').trim();
    if (!n) continue;
    counts.set(n, (counts.get(n) || 0) + 1);
  }
  const dupes = new Set<string>();
  for (const [name, count] of counts) {
    if (count > 1) dupes.add(name);
  }
  return dupes;
}

/**
 * Asigna un boleto a lo sumo una sección del evento.
 * Si tiene `sectionId`, solo coincide por id (evita doble conteo cuando hay varias secciones con el mismo nombre).
 * Sin id: fallback legacy por `sectionName` solo si el nombre es único en el evento.
 */
export function ticketBelongsToSection(
  t: Ticket,
  sec: Pick<EventSection, 'id' | 'name'>,
  duplicateNames: Set<string>
): boolean {
  const sid = String(t.sectionId || '').trim();
  const secId = String(sec.id || '').trim();
  if (sid) {
    return sid === secId;
  }
  const ticketName = String(t.sectionName || '').trim();
  const secName = String(sec.name || '').trim();
  if (!ticketName || !secName || ticketName !== secName) return false;
  return !duplicateNames.has(secName);
}

export function validTicketsForReportSales(t: Ticket): boolean {
  return isTicketValidForSalesStats(t);
}

export function isCourtesyTicket(t: Ticket): boolean {
  return Boolean(
    (t as { isCourtesy?: boolean }).isCourtesy || (t as { isGeneralCourtesy?: boolean }).isGeneralCourtesy
  );
}

export function parseYmdLocal(ymd: string): Date {
  const [y, m, d] = ymd.split('-').map((x) => parseInt(x, 10));
  return new Date(y, (m || 1) - 1, d || 1);
}

export function dayStartMs(d: Date): number {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate(), 0, 0, 0, 0).getTime();
}

export function dayEndMs(d: Date): number {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59, 59, 999).getTime();
}

export function todayRangeMs(): { start: number; end: number } {
  const n = new Date();
  return { start: dayStartMs(n), end: dayEndMs(n) };
}
