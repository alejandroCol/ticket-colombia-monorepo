import type { Event, Ticket } from '@services/types';
import {
  aggregateEventRevenueBreakdown,
  computeTicketTiqueteraFeeCOP,
  ticketIsGatewayOnlineSale,
  ticketIsManualLike,
  ticketUsesMercadoPagoCheckout,
  type EventRevenueBreakdownTotals,
  type GatewayCommissionConfig,
  type OrganizerBuyerFeeInput,
} from '@utils/revenueBreakdown';
import { ticketDocUnits } from '@utils/ticketListDisplay';
import {
  ticketHasLinkedOnepayPayment,
  ticketReconcilesWithOnepay,
  ticketWasReissuedAfterTransfer,
} from '@utils/ticketPaymentReference';
import { applyGatewayCommissionFinalOverrides } from '@utils/gatewayCommissionOverride';

/** Aviso junto a comisiones OnePay estimadas en admin. */
export const ONEPAY_PASARELA_COMMISSION_DISCLAIMER =
  'Sujeto a variaciones de tarifas si es tarjeta de crédito internacional.';

export type SalesChannel = 'gateway' | 'manual';

export type SalesChannelSlice = EventRevenueBreakdownTotals & {
  ticketDocs: number;
  ticketUnits: number;
};

export type OnlineGatewayProvider = 'onepay' | 'mercadopago';

/** Hojas del Excel de cierre de caja (estadísticas del evento). */
export type TicketCierreCajaSheet = 'onepay' | 'mercadopago' | 'manual';

export type SalesChannelBreakdown = {
  gateway: SalesChannelSlice;
  /** Subtotal cobros OnePay (incluye ventas reemitidas con `transfer_*`). */
  gatewayOnepay: SalesChannelSlice;
  /** Ventas con preferencia Mercado Pago (histórico / legacy). */
  gatewayMercadopago: SalesChannelSlice;
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

/** Ventas que cuentan en el bloque «Pasarela (en línea)» (incl. manual vinculado a OnePay). */
export function ticketInPasarelaSalesBlock(t: Ticket): boolean {
  return ticketIsGatewayOnlineSale(t) || ticketHasLinkedOnepayPayment(t);
}

/** Clasifica el canal de cobro de una venta válida (sin cortesías). */
export function ticketSalesChannel(t: Ticket): SalesChannel {
  if (ticketInPasarelaSalesBlock(t)) return 'gateway';
  if (ticketIsManualLike(t)) return 'manual';
  return 'manual';
}

/** Proveedor de pasarela para ventas en línea (null si no aplica). */
export function ticketOnlineGatewayProvider(t: Ticket): OnlineGatewayProvider | null {
  if (ticketHasLinkedOnepayPayment(t)) return 'onepay';
  if (!ticketIsGatewayOnlineSale(t)) return null;
  if (ticketUsesMercadoPagoCheckout(t)) return 'mercadopago';
  return 'onepay';
}

/**
 * Hoja del Excel de cierre: misma partición que `gatewayOnepay`, `gatewayMercadopago` y `manual`
 * en {@link aggregateSalesChannelBreakdown}. Usar solo sobre ventas válidas (pagadas/usadas, con cobro).
 */
export function ticketCierreCajaSheetChannel(t: Ticket): TicketCierreCajaSheet {
  if (ticketReconcilesWithOnepay(t)) return 'onepay';
  if (ticketInPasarelaSalesBlock(t) && ticketUsesMercadoPagoCheckout(t)) return 'mercadopago';
  if (ticketIsManualLike(t) && !ticketHasLinkedOnepayPayment(t)) return 'manual';
  if (ticketInPasarelaSalesBlock(t)) return 'onepay';
  return 'manual';
}

export function salesChannelLabel(channel: SalesChannel): string {
  return channel === 'gateway' ? 'Pasarela (en línea)' : 'Manual / taquilla';
}

/** Etiqueta legible del método de pago para reportes y exportaciones. */
export function ticketPaymentChannelLabel(t: Ticket): string {
  if (ticketHasLinkedOnepayPayment(t)) return 'OnePay (vinculado · taquilla)';
  if (ticketIsManualLike(t)) {
    if ((t as { createdByAdmin?: string }).createdByAdmin) return 'Taquilla / admin';
    const pm = String(t.paymentMethod || '').toLowerCase();
    if (pm === 'admin_manual') return 'Pago confirmado manualmente';
    if (pm === 'transfer') return 'Transferencia';
    if (pm === 'free') return 'Gratis';
    return 'Manual';
  }
  if (ticketWasReissuedAfterTransfer(t)) return 'OnePay (boleto transferido)';
  if (ticketUsesMercadoPagoCheckout(t)) return 'Mercado Pago';
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
  const gatewayTickets = validTickets.filter(ticketInPasarelaSalesBlock);
  const gatewayOnepayTickets = validTickets.filter(ticketReconcilesWithOnepay);
  const gatewayMercadopagoTickets = gatewayTickets.filter(ticketUsesMercadoPagoCheckout);
  const manualTickets = validTickets.filter(
    (t) => ticketIsManualLike(t) && !ticketHasLinkedOnepayPayment(t)
  );

  const gateway = sliceFromTickets(
    event,
    gatewayTickets,
    globalFeesPercent,
    organizerFee,
    gatewayConfig
  );
  const gatewayOnepay = sliceFromTickets(
    event,
    gatewayOnepayTickets,
    globalFeesPercent,
    organizerFee,
    gatewayConfig
  );
  const gatewayMercadopago = sliceFromTickets(
    event,
    gatewayMercadopagoTickets,
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

  const base: SalesChannelBreakdown = {
    gateway,
    gatewayOnepay,
    gatewayMercadopago,
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

  return applyGatewayCommissionFinalOverrides(event, base);
}
