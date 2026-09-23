import type { Event, Ticket } from '@services/types';
import {
  aggregateEventRevenueBreakdown,
  computeTicketTiqueteraFeeCOP,
  ticketIsGatewayOnlineSale,
  ticketIsManualLike,
  type EventRevenueBreakdownTotals,
  type GatewayCommissionConfig,
  type OrganizerBuyerFeeInput,
} from '@utils/revenueBreakdown';
import { ticketDocUnits } from '@utils/ticketListDisplay';

export type SalesChannel = 'gateway' | 'manual';

export type SalesChannelSlice = EventRevenueBreakdownTotals & {
  ticketDocs: number;
  ticketUnits: number;
};

export type SalesChannelBreakdown = {
  gateway: SalesChannelSlice;
  manual: SalesChannelSlice;
  combined: EventRevenueBreakdownTotals;
  /** Tarifa tiquetera total (pasarela + manual), mostrada en el bloque pasarela. */
  combinedTiqueteraFee: number;
  combinedTiqueteraBoletas: number;
  /** Neto del bloque pasarela después de tarifa tiquetera total y comisión pasarela. */
  pasarelaNetoOrganizador: number;
};

function sumTicketUnits(tickets: Ticket[]): number {
  return tickets.reduce((sum, t) => sum + ticketDocUnits(t), 0);
}

function sliceFromTickets(
  event: Event,
  tickets: Ticket[],
  globalFeesPercent: number,
  organizerFee: OrganizerBuyerFeeInput,
  gateway: GatewayCommissionConfig
): SalesChannelSlice {
  const totals = aggregateEventRevenueBreakdown(
    event,
    tickets,
    globalFeesPercent,
    organizerFee,
    gateway
  );
  return {
    ...totals,
    ticketDocs: tickets.length,
    ticketUnits: sumTicketUnits(tickets),
  };
}

/** Clasifica el canal de cobro de una venta válida (sin cortesías). */
export function ticketSalesChannel(t: Ticket): SalesChannel {
  if (ticketIsManualLike(t)) return 'manual';
  return ticketIsGatewayOnlineSale(t) ? 'gateway' : 'manual';
}

export function salesChannelLabel(channel: SalesChannel): string {
  return channel === 'gateway' ? 'Pasarela (en línea)' : 'Manual / taquilla';
}

/** Etiqueta legible del método de pago para reportes y exportaciones. */
export function ticketPaymentChannelLabel(t: Ticket): string {
  if (ticketIsManualLike(t)) {
    if ((t as { createdByAdmin?: string }).createdByAdmin) return 'Taquilla / admin';
    const pm = String(t.paymentMethod || '').toLowerCase();
    if (pm === 'admin_manual') return 'Pago confirmado manualmente';
    if (pm === 'transfer') return 'Transferencia';
    if (pm === 'free') return 'Gratis';
    return 'Manual';
  }
  const pm = String(t.paymentMethod || '').toLowerCase();
  if (pm.includes('mercadopago')) return 'Mercado Pago';
  if (pm.includes('onepay') || pm === 'onepay') return 'OnePay';
  return String(t.paymentMethod || 'Pasarela').trim() || 'Pasarela';
}

/**
 * Agrega métricas de ventas separadas por pasarela en línea vs cobros manuales/taquilla.
 */
export function aggregateSalesChannelBreakdown(
  event: Event,
  validTickets: Ticket[],
  globalFeesPercent: number,
  organizerFee: OrganizerBuyerFeeInput,
  gatewayConfig: GatewayCommissionConfig
): SalesChannelBreakdown {
  const gatewayTickets = validTickets.filter(ticketIsGatewayOnlineSale);
  const manualTickets = validTickets.filter(ticketIsManualLike);

  const gateway = sliceFromTickets(
    event,
    gatewayTickets,
    globalFeesPercent,
    organizerFee,
    gatewayConfig
  );
  const manual = sliceFromTickets(event, manualTickets, globalFeesPercent, organizerFee, gatewayConfig);

  const combinedTiqueteraFee = validTickets.reduce(
    (sum, t) => sum + computeTicketTiqueteraFeeCOP(t, event, globalFeesPercent, organizerFee),
    0
  );
  const combinedTiqueteraBoletas = gateway.ticketUnits + manual.ticketUnits;
  const pasarelaNetoOrganizador = Math.max(
    0,
    gateway.totalCobrado - combinedTiqueteraFee - gateway.pasarelaTotal
  );

  return {
    gateway,
    manual,
    combined: aggregateEventRevenueBreakdown(
      event,
      validTickets,
      globalFeesPercent,
      organizerFee,
      gatewayConfig
    ),
    combinedTiqueteraFee,
    combinedTiqueteraBoletas,
    pasarelaNetoOrganizador,
  };
}
