import type { Event, EventSection } from '../services/types';
import type { OrganizerBuyerFeeDoc } from '../services/firestore';

export type BuyerFeeLine =
  | 'event_pct'
  | 'event_fixed'
  | 'org_pct'
  | 'org_fixed'
  | 'global_pct';

/**
 * Unidades para multiplicar la tarifa **fija por entrada** (percent sigue solo sobre el subtotal).
 * Palco multipersona en mapa: `quantity` de checkout/reserva ya es N personas.
 * Palco multipersona sin mapa: cada unidad de compra lleva N personas → N × unidades.
 */
export function buyerFeeFixedUnitCount(
  quantity: number,
  section: EventSection | undefined,
  mapZoneId: string | undefined
): number {
  const q = Math.max(1, quantity);
  if (!section) return q;
  const n = Math.max(1, Number(section.seats_per_unit) || 1);
  const palcoMulti = section.palco_multipersona === true && n > 1;
  if (!palcoMulti) return q;
  const mz = String(mapZoneId || '').trim();
  if (mz) return q;
  return q * n;
}

/** Tarifa de servicio al comprar **una** unidad de esta localidad (un palco total o una entrada). */
export function estimatedBuyerFeeForOneLocalityUnit(
  section: EventSection,
  event: Event,
  globalFeesPercent: number,
  organizerFee: OrganizerBuyerFeeDoc | null
): number {
  const sub = Math.max(0, Number(section.price) || 0);
  if (sub <= 0) return 0;
  const n = Math.max(1, Number(section.seats_per_unit) || 1);
  const palcoMulti = section.palco_multipersona === true && n > 1;
  const fixedUnits = palcoMulti ? n : 1;
  return computeBuyerServiceFeeCOP(sub, 1, event, globalFeesPercent, organizerFee, {
    fixedFeeUnitCount: fixedUnits,
  }).feeCOP;
}

export function computeBuyerServiceFeeCOP(
  subtotal: number,
  quantity: number,
  event: Event,
  globalFeesPercent: number,
  organizerFee: OrganizerBuyerFeeDoc | null,
  options?: { fixedFeeUnitCount?: number }
): { feeCOP: number; line: BuyerFeeLine; detailValue: number } {
  const qty = Math.max(1, quantity);
  const qFixed = Math.max(1, options?.fixedFeeUnitCount ?? qty);
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
      feeCOP: Math.round(value * qFixed),
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
      feeCOP: Math.round(oVal * qFixed),
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
