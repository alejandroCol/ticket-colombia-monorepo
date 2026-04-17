import type { Timestamp } from 'firebase/firestore';
import {
  getEventOrRecurringById,
  getExpensesByEventId,
  getOrganizerBuyerFee,
} from '@services';
import { aggregateEventRevenueBreakdown, normalizeGatewayCommissionConfig } from '@utils/revenueBreakdown';
import type { OrganizerBuyerFeeInput } from '@utils/revenueBreakdown';
import { getTicketsByEventId } from '@services/ticketService';
import type { Ticket } from '@services/types';
import type { AdminPaymentConfig } from '@services/firestore';

export interface ListedEvent {
  id: string;
  name: string;
  city: string;
  date: string;
  sortMs: number;
  isRecurring: boolean;
  organizer_id: string;
}

export interface EventBalanceRow extends ListedEvent {
  ticketsSold: number;
  ingresos: number;
  egresos: number;
  subtotalEntradas: number;
  tiqueteraFee: number;
  pasarelaTotal: number;
  pasarelaPct: number;
  pasarelaFixed: number;
  pasarelaIva: number;
  netoOrganizador: number;
}

export const emptyMoneyBreakdown = {
  subtotalEntradas: 0,
  tiqueteraFee: 0,
  pasarelaTotal: 0,
  pasarelaPct: 0,
  pasarelaFixed: 0,
  pasarelaIva: 0,
  netoOrganizador: 0,
};

export function validTicketsForBalance(tickets: Ticket[]): Ticket[] {
  return tickets.filter((t) => {
    const status = t.ticketStatus as string;
    const invalid =
      ['cancelled', 'disabled'].includes(status) || (t as { transferredTo?: string }).transferredTo;
    const valid = ['paid', 'reserved', 'used', 'redeemed'].includes(status);
    if ((t as { ticketKind?: string }).ticketKind === 'purchase_pass') return false;
    return valid && !invalid;
  });
}

export type BalanceLoadContext = {
  globalFeesPercent: number;
  gateway: ReturnType<typeof normalizeGatewayCommissionConfig>;
  orgFeeCache: Map<string, OrganizerBuyerFeeInput>;
};

export async function loadEventBalanceRow(
  listed: ListedEvent,
  ctx: BalanceLoadContext
): Promise<EventBalanceRow> {
  try {
    const [tickets, expenses, eventDoc] = await Promise.all([
      getTicketsByEventId(listed.id),
      getExpensesByEventId(listed.id),
      getEventOrRecurringById(listed.id),
    ]);
    const valid = validTicketsForBalance(tickets);
    const ticketsSold = valid.reduce((s, t) => s + (t.quantity || 1), 0);
    const ingresos = valid.reduce((s, t) => s + (t.amount || 0), 0);
    const egresos = expenses.reduce((s, e) => s + (e.amount || 0), 0);
    if (!eventDoc) {
      return { ...listed, ticketsSold, ingresos, egresos, ...emptyMoneyBreakdown };
    }
    const orgId = String(listed.organizer_id || eventDoc.organizer_id || '').trim();
    let orgFee = ctx.orgFeeCache.get(orgId) ?? null;
    if (!ctx.orgFeeCache.has(orgId)) {
      const feeDoc = orgId ? await getOrganizerBuyerFee(orgId) : null;
      orgFee = feeDoc ? { type: feeDoc.fee_type, value: feeDoc.fee_value } : null;
      ctx.orgFeeCache.set(orgId, orgFee);
    }
    const agg = aggregateEventRevenueBreakdown(
      eventDoc,
      valid,
      ctx.globalFeesPercent,
      orgFee,
      ctx.gateway
    );
    return {
      ...listed,
      ticketsSold,
      ingresos,
      egresos,
      subtotalEntradas: agg.subtotalEntradas,
      tiqueteraFee: agg.tiqueteraFee,
      pasarelaTotal: agg.pasarelaTotal,
      pasarelaPct: agg.pasarelaPercentPart,
      pasarelaFixed: agg.pasarelaFixedPart,
      pasarelaIva: agg.pasarelaIva,
      netoOrganizador: agg.netoOrganizador,
    };
  } catch {
    return {
      ...listed,
      ticketsSold: 0,
      ingresos: 0,
      egresos: 0,
      ...emptyMoneyBreakdown,
    };
  }
}

export async function loadBalanceRows(
  listed: ListedEvent[],
  ctx: BalanceLoadContext
): Promise<EventBalanceRow[]> {
  const chunkSize = 6;
  const rows: EventBalanceRow[] = [];
  for (let i = 0; i < listed.length; i += chunkSize) {
    const chunk = listed.slice(i, i + chunkSize);
    const part = await Promise.all(chunk.map((ev) => loadEventBalanceRow(ev, ctx)));
    rows.push(...part);
  }
  return rows;
}

export function eventDateSortMs(data: Record<string, unknown>): number {
  const ed = data.event_date as Timestamp | undefined;
  if (ed && typeof ed.toMillis === 'function') return ed.toMillis();
  return 0;
}

export function buildBalanceLoadContext(pay: AdminPaymentConfig | null): BalanceLoadContext {
  const globalFeesPercent = pay?.fees ?? 9;
  const gateway = normalizeGatewayCommissionConfig(pay || undefined);
  return {
    globalFeesPercent,
    gateway,
    orgFeeCache: new Map(),
  };
}
