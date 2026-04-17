import type { Event, Ticket } from '@services/types';

/** Tarifa al comprador por organizador (misma prioridad que el backend). */
export type OrganizerBuyerFeeInput = { type: string; value: number } | null;

/** Comisión de pasarela global (super admin → `configurations/payments_config`). */
export type GatewayCommissionConfig = {
  gateway_commission_percent: number;
  gateway_commission_fixed_cop: number;
  gateway_commission_iva_percent: number;
};

/** Valores por defecto al crear formulario: sin % ni fijo hasta que el super admin guarde (IVA 19 % sobre la base). */
export const GATEWAY_IVA_DEFAULT_PERCENT = 19;

export function normalizeGatewayCommissionConfig(
  raw: Partial<GatewayCommissionConfig> | null | undefined
): GatewayCommissionConfig {
  return {
    gateway_commission_percent:
      raw?.gateway_commission_percent != null ? Number(raw.gateway_commission_percent) || 0 : 0,
    gateway_commission_fixed_cop:
      raw?.gateway_commission_fixed_cop != null ? Number(raw.gateway_commission_fixed_cop) || 0 : 0,
    gateway_commission_iva_percent:
      raw?.gateway_commission_iva_percent != null
        ? Number(raw.gateway_commission_iva_percent) || 0
        : GATEWAY_IVA_DEFAULT_PERCENT,
  };
}

type SectionLite = { id: string; palco_multipersona?: boolean; seats_per_unit?: number };

/**
 * Unidades para tarifa fija por entrada (misma lógica que `pricing-from-event.ts` en Functions).
 */
export function buyerFeeFixedUnitCountFromRequest(
  quantity: number,
  eventData: Pick<Event, 'sections'>,
  sectionId?: string,
  mapZoneId?: string
): number {
  const q = Math.max(1, Math.floor(Number(quantity) || 1));
  const sid = String(sectionId || '').trim();
  const mz = String(mapZoneId || '').trim();
  const sections = eventData.sections as SectionLite[] | undefined;
  const sec = sections?.find((s) => String(s.id || '').trim() === sid);
  const n = Math.max(1, Number(sec?.seats_per_unit) || 1);
  const palcoMulti = sec?.palco_multipersona === true && n > 1;
  if (!palcoMulti) return q;
  if (mz) return q;
  return q * n;
}

export function computeServiceFeeCOP(
  subtotalCOP: number,
  quantity: number,
  eventData: Pick<Event, 'platform_commission_type' | 'platform_commission_value'>,
  globalFeesPercent: number,
  organizerFee: OrganizerBuyerFeeInput = null,
  fixedFeeUnitCount?: number
): { feeCOP: number } {
  const qty = Math.max(1, quantity);
  const qFixed = Math.max(1, fixedFeeUnitCount ?? qty);
  const type = String(eventData.platform_commission_type || '').trim();
  const value = Number(eventData.platform_commission_value) || 0;

  if (type === 'percent_payer' && value > 0) {
    return { feeCOP: Math.round(subtotalCOP * (value / 100)) };
  }
  if (type === 'fixed_per_ticket' && value > 0) {
    return { feeCOP: Math.round(value * qFixed) };
  }

  const oType = String(organizerFee?.type || '').trim();
  const oVal = Number(organizerFee?.value) || 0;
  if (oType === 'percent_payer' && oVal > 0) {
    return { feeCOP: Math.round(subtotalCOP * (oVal / 100)) };
  }
  if (oType === 'fixed_per_ticket' && oVal > 0) {
    return { feeCOP: Math.round(oVal * qFixed) };
  }

  const pct = Math.max(0, Number(globalFeesPercent) || 0);
  return { feeCOP: Math.round(subtotalCOP * (pct / 100)) };
}

function ticketIsManualLike(t: Ticket): boolean {
  if ((t as { createdByAdmin?: string }).createdByAdmin) return true;
  const pm = String(t.paymentMethod || '').toLowerCase();
  return pm === 'manual' || pm === 'transfer' || pm === 'free';
}

/**
 * A partir del total cobrado al comprador (subtotal + tarifa tiquetera), infiere el subtotal de entradas.
 * Ventas manuales / transferencia: se asume que `amount` es solo valor de entradas (sin tarifa de servicio en línea).
 */
export function inferSubtotalAndTiqueteraFee(
  paidTotal: number,
  quantity: number,
  eventData: Event,
  globalFeesPercent: number,
  organizerFee: OrganizerBuyerFeeInput,
  sectionId: string | undefined,
  mapZoneId: string | undefined,
  manualLike: boolean
): { subtotal: number; tiqueteraFee: number } {
  const A = Math.max(0, Math.round(paidTotal));
  if (A <= 0) return { subtotal: 0, tiqueteraFee: 0 };
  if (manualLike) {
    return { subtotal: A, tiqueteraFee: 0 };
  }
  const fixUnits = buyerFeeFixedUnitCountFromRequest(quantity, eventData, sectionId, mapZoneId);

  let lo = 0;
  let hi = A;
  for (let i = 0; i < 48; i++) {
    const mid = Math.floor((lo + hi + 1) / 2);
    const f = computeServiceFeeCOP(mid, quantity, eventData, globalFeesPercent, organizerFee, fixUnits).feeCOP;
    if (mid + f <= A) lo = mid;
    else hi = mid - 1;
  }
  let subtotal = lo;
  let feeCOP = computeServiceFeeCOP(subtotal, quantity, eventData, globalFeesPercent, organizerFee, fixUnits).feeCOP;
  while (subtotal + 1 <= A) {
    const nf = computeServiceFeeCOP(subtotal + 1, quantity, eventData, globalFeesPercent, organizerFee, fixUnits).feeCOP;
    if (subtotal + 1 + nf <= A) {
      subtotal += 1;
      feeCOP = nf;
    } else break;
  }
  return { subtotal, tiqueteraFee: feeCOP };
}

/**
 * Comisión de pasarela por transacción de cobro en línea (un pago = un cargo de pasarela).
 * % sobre el subtotal de esa transacción + COP fijos una sola vez por transacción (no por asiento ni por QR del palco).
 * Luego IVA sobre esa base. Todo en COP enteros.
 */
export function computePasarelaCommissionCOP(
  subtotalCOP: number,
  cfg: GatewayCommissionConfig
): {
  percentPart: number;
  fixedPart: number;
  baseBeforeIva: number;
  iva: number;
  total: number;
} {
  const pct = Math.max(0, Number(cfg.gateway_commission_percent) || 0);
  const fixPer = Math.max(0, Number(cfg.gateway_commission_fixed_cop) || 0);
  const ivaRate = Math.max(0, Number(cfg.gateway_commission_iva_percent) || 0);
  const sub = Math.max(0, Math.round(subtotalCOP));
  const percentPart = Math.round(sub * (pct / 100));
  const fixedPart = Math.round(fixPer);
  const baseBeforeIva = percentPart + fixedPart;
  const iva = Math.round(baseBeforeIva * (ivaRate / 100));
  return {
    percentPart,
    fixedPart,
    baseBeforeIva,
    iva,
    total: baseBeforeIva + iva,
  };
}

export type EventRevenueBreakdownTotals = {
  totalCobrado: number;
  subtotalEntradas: number;
  tiqueteraFee: number;
  pasarelaPercentPart: number;
  pasarelaFixedPart: number;
  pasarelaIva: number;
  pasarelaTotal: number;
  /** Subtotal de entradas menos comisión total de pasarela (estimado). */
  netoOrganizador: number;
};

/**
 * Agrega desglose por lista de boletos válidos y un mismo evento.
 */
export function aggregateEventRevenueBreakdown(
  event: Event,
  validTickets: Ticket[],
  globalFeesPercent: number,
  organizerFee: OrganizerBuyerFeeInput,
  gateway: GatewayCommissionConfig
): EventRevenueBreakdownTotals {
  let totalCobrado = 0;
  let subtotalEntradas = 0;
  let tiqueteraFee = 0;
  let pasarelaPercentPart = 0;
  let pasarelaFixedPart = 0;
  let pasarelaIva = 0;
  let pasarelaTotal = 0;

  for (const t of validTickets) {
    const qty = Math.max(1, Math.floor(Number(t.quantity) || 1));
    const amount = Math.round(Number(t.amount) || 0);
    totalCobrado += amount;
    const manual = ticketIsManualLike(t);
    const sid = (t as { sectionId?: string }).sectionId;
    const mz = (t as { mapZoneId?: string }).mapZoneId;
    const { subtotal, tiqueteraFee: tf } = inferSubtotalAndTiqueteraFee(
      amount,
      qty,
      event,
      globalFeesPercent,
      organizerFee,
      sid,
      mz,
      manual
    );
    subtotalEntradas += subtotal;
    tiqueteraFee += tf;

    if (!manual && amount > 0) {
      const p = computePasarelaCommissionCOP(subtotal, gateway);
      pasarelaPercentPart += p.percentPart;
      pasarelaFixedPart += p.fixedPart;
      pasarelaIva += p.iva;
      pasarelaTotal += p.total;
    }
  }

  const netoOrganizador = Math.max(0, subtotalEntradas - pasarelaTotal);
  return {
    totalCobrado,
    subtotalEntradas,
    tiqueteraFee,
    pasarelaPercentPart,
    pasarelaFixedPart,
    pasarelaIva,
    pasarelaTotal,
    netoOrganizador,
  };
}

/**
 * Valor neto para el organizador de un boleto (subtotal entradas − comisión pasarela de pagos).
 * La tarifa tiquetera queda fuera del subtotal; ventas manuales no aplican pasarela.
 */
export function ticketNetOrganizerCOP(
  t: Ticket,
  event: Event,
  globalFeesPercent: number,
  organizerFee: OrganizerBuyerFeeInput,
  gateway: GatewayCommissionConfig
): number {
  const qty = Math.max(1, Math.floor(Number(t.quantity) || 1));
  const amount = Math.round(Number(t.amount) || 0);
  const manual = ticketIsManualLike(t);
  const sid = (t as { sectionId?: string }).sectionId;
  const mz = (t as { mapZoneId?: string }).mapZoneId;
  const { subtotal } = inferSubtotalAndTiqueteraFee(
    amount,
    qty,
    event,
    globalFeesPercent,
    organizerFee,
    sid,
    mz,
    manual
  );
  if (manual || amount <= 0) {
    return Math.max(0, subtotal);
  }
  const p = computePasarelaCommissionCOP(subtotal, gateway);
  return Math.max(0, subtotal - p.total);
}
