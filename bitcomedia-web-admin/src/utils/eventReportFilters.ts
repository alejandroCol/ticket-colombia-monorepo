import type { Ticket } from '@services/types';

export function validTicketsForReportSales(t: Ticket): boolean {
  const status = t.ticketStatus as string;
  const invalid =
    ['cancelled', 'disabled'].includes(status) || (t as { transferredTo?: string }).transferredTo;
  const valid = ['paid', 'reserved', 'used', 'redeemed'].includes(status);
  if ((t as { ticketKind?: string }).ticketKind === 'purchase_pass') return false;
  return valid && !invalid;
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
