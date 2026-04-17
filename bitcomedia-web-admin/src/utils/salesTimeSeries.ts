import type { Ticket } from '@services/types';
import { ticketCreatedAtMs } from '@services/ticketService';

export function toYmdLocal(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function parseYmdLocal(s: string): Date {
  const [y, m, d] = s.split('-').map((x) => parseInt(x, 10));
  return new Date(y, (m || 1) - 1, d || 1);
}

export type DailySalesPoint = {
  dayKey: string;
  labelShort: string;
  revenue: number;
  ticketUnits: number;
};

/** Un punto por día calendario (local), incluyendo días sin ventas en 0. */
export function buildDailySalesSeries(
  validTickets: Ticket[],
  fromYmd: string,
  toYmd: string
): DailySalesPoint[] {
  const from = parseYmdLocal(fromYmd);
  const to = parseYmdLocal(toYmd);
  if (from > to) return [];

  const byDay = new Map<string, { revenue: number; ticketUnits: number }>();
  for (const t of validTickets) {
    const ms = ticketCreatedAtMs(t);
    if (!ms) continue;
    const dayKey = toYmdLocal(new Date(ms));
    if (dayKey < fromYmd || dayKey > toYmd) continue;
    const cur = byDay.get(dayKey) || { revenue: 0, ticketUnits: 0 };
    cur.revenue += Number(t.amount) || 0;
    cur.ticketUnits += Number(t.quantity) || 1;
    byDay.set(dayKey, cur);
  }

  const out: DailySalesPoint[] = [];
  const cursor = new Date(from.getFullYear(), from.getMonth(), from.getDate());
  const endDay = new Date(to.getFullYear(), to.getMonth(), to.getDate());
  while (cursor <= endDay) {
    const dayKey = toYmdLocal(cursor);
    const v = byDay.get(dayKey) || { revenue: 0, ticketUnits: 0 };
    out.push({
      dayKey,
      labelShort: cursor.toLocaleDateString('es-CO', { day: 'numeric', month: 'short' }),
      revenue: v.revenue,
      ticketUnits: v.ticketUnits,
    });
    cursor.setDate(cursor.getDate() + 1);
  }
  return out;
}

export function defaultLastNDaysRange(nDays: number): { from: string; to: string } {
  const end = new Date();
  const start = new Date(end);
  start.setDate(start.getDate() - (nDays - 1));
  return { from: toYmdLocal(start), to: toYmdLocal(end) };
}
