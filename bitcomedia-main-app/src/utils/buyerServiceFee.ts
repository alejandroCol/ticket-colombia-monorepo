import type { Event } from '../services/types';
import type { OrganizerBuyerFeeDoc } from '../services/firestore';

export type BuyerFeeLine =
  | 'event_pct'
  | 'event_fixed'
  | 'org_pct'
  | 'org_fixed'
  | 'global_pct';

export function computeBuyerServiceFeeCOP(
  subtotal: number,
  quantity: number,
  event: Event,
  globalFeesPercent: number,
  organizerFee: OrganizerBuyerFeeDoc | null
): { feeCOP: number; line: BuyerFeeLine; detailValue: number } {
  const qty = Math.max(1, quantity);
  const type = String(event.platform_commission_type || '').trim();
  const value = Number(event.platform_commission_value) || 0;

  if (type === 'percent_payer' && value > 0) {
    return {
      feeCOP: Math.round(subtotal * (value / 100)),
      line: 'event_pct',
      detailValue: value,
    };
  }
  if (type === 'fixed_per_ticket' && value > 0) {
    return {
      feeCOP: Math.round(value * qty),
      line: 'event_fixed',
      detailValue: value,
    };
  }

  const oType = String(organizerFee?.fee_type || '').trim();
  const oVal = Number(organizerFee?.fee_value) || 0;
  if (oType === 'percent_payer' && oVal > 0) {
    return {
      feeCOP: Math.round(subtotal * (oVal / 100)),
      line: 'org_pct',
      detailValue: oVal,
    };
  }
  if (oType === 'fixed_per_ticket' && oVal > 0) {
    return {
      feeCOP: Math.round(oVal * qty),
      line: 'org_fixed',
      detailValue: oVal,
    };
  }

  const pct = Math.max(0, Number(globalFeesPercent) || 0);
  return {
    feeCOP: Math.round(subtotal * (pct / 100)),
    line: 'global_pct',
    detailValue: pct,
  };
}

/** Texto para el comprador: siempre “Tarifa de servicio”, con detalle entre paréntesis. */
export function buyerServiceFeeLabel(
  formatPrice: (n: number) => string,
  line: BuyerFeeLine,
  detailValue: number,
  quantity: number
): string {
  const q = Math.max(1, quantity);
  switch (line) {
    case 'event_pct':
    case 'org_pct':
    case 'global_pct':
      return `Tarifa de servicio (${detailValue}%)`;
    case 'event_fixed':
    case 'org_fixed':
      return q === 1
        ? `Tarifa de servicio (${formatPrice(detailValue)} por entrada)`
        : `Tarifa de servicio (${formatPrice(detailValue)} × ${q} entradas)`;
    default:
      return 'Tarifa de servicio';
  }
}
