import type { Event } from '@services/types';
import type { SalesChannelBreakdown, SalesChannelSlice } from '@utils/salesChannelBreakdown';
import type { EventRevenueBreakdownTotals } from '@utils/revenueBreakdown';

export type GatewayCommissionFinalOverrides = {
  onepayCOP: number | null;
  mercadopagoCOP: number | null;
};

function parseOverrideCOP(raw: unknown): number | null {
  if (raw === null || raw === undefined || raw === '') return null;
  const n = Math.round(Number(raw));
  if (!Number.isFinite(n) || n < 0) return null;
  return n;
}

export function readGatewayCommissionFinalOverrides(event: Event): GatewayCommissionFinalOverrides {
  const e = event as Event & {
    gateway_commission_final_onepay_cop?: unknown;
    gateway_commission_final_mercadopago_cop?: unknown;
  };
  return {
    onepayCOP: parseOverrideCOP(e.gateway_commission_final_onepay_cop),
    mercadopagoCOP: parseOverrideCOP(e.gateway_commission_final_mercadopago_cop),
  };
}

export function hasGatewayCommissionFinalOverride(event: Event): boolean {
  const ov = readGatewayCommissionFinalOverrides(event);
  return ov.onepayCOP != null || ov.mercadopagoCOP != null;
}

export function pasarelaCommissionRowLabel(
  slice: Pick<EventRevenueBreakdownTotals, 'pasarelaCommissionIsFinalOverride'>
): string {
  return slice.pasarelaCommissionIsFinalOverride
    ? 'Comisión pasarela (final)'
    : 'Comisión pasarela (est.)';
}

function patchSlicePasarelaTotal(
  slice: SalesChannelSlice,
  finalCOP: number | null,
  forceShowCommission?: boolean
): SalesChannelSlice {
  if (finalCOP == null) return slice;
  const delta = finalCOP - slice.pasarelaTotal;
  return {
    ...slice,
    pasarelaTotal: finalCOP,
    pasarelaPercentPart: 0,
    pasarelaFixedPart: 0,
    pasarelaIva: 0,
    netoOrganizador: Math.max(0, slice.netoOrganizador - delta),
    pasarelaCommissionIsFinalOverride: true,
    showPasarelaCommission: forceShowCommission ?? slice.showPasarelaCommission,
  };
}

function patchCombinedPasarela(
  combined: EventRevenueBreakdownTotals,
  totalPasarelaFinal: number
): EventRevenueBreakdownTotals {
  const delta = totalPasarelaFinal - combined.pasarelaTotal;
  const hasOverride = delta !== 0 || combined.pasarelaCommissionIsFinalOverride;
  if (!hasOverride && totalPasarelaFinal === combined.pasarelaTotal) {
    return combined;
  }
  return {
    ...combined,
    pasarelaTotal: totalPasarelaFinal,
    pasarelaPercentPart: 0,
    pasarelaFixedPart: 0,
    pasarelaIva: 0,
    netoOrganizador: Math.max(0, combined.netoOrganizador - delta),
    pasarelaCommissionIsFinalOverride: true,
    showPasarelaCommission: true,
  };
}

/** Reemplaza comisiones pasarela estimadas por valores finales del super admin (por evento). */
export function applyGatewayCommissionFinalOverrides(
  event: Event,
  breakdown: SalesChannelBreakdown
): SalesChannelBreakdown {
  const ov = readGatewayCommissionFinalOverrides(event);
  if (ov.onepayCOP == null && ov.mercadopagoCOP == null) return breakdown;

  const gatewayOnepay = patchSlicePasarelaTotal(breakdown.gatewayOnepay, ov.onepayCOP);
  const gatewayMercadopago = patchSlicePasarelaTotal(
    breakdown.gatewayMercadopago,
    ov.mercadopagoCOP,
    ov.mercadopagoCOP != null
  );

  const onepayPas = ov.onepayCOP ?? breakdown.gatewayOnepay.pasarelaTotal;
  const mpPas = ov.mercadopagoCOP ?? breakdown.gatewayMercadopago.pasarelaTotal;
  const gatewayPasarelaTotal = onepayPas + mpPas;
  const gatewayDelta = gatewayPasarelaTotal - breakdown.gateway.pasarelaTotal;

  const gateway: SalesChannelSlice = {
    ...breakdown.gateway,
    pasarelaTotal: gatewayPasarelaTotal,
    pasarelaPercentPart: ov.onepayCOP != null || ov.mercadopagoCOP != null ? 0 : breakdown.gateway.pasarelaPercentPart,
    pasarelaFixedPart: ov.onepayCOP != null || ov.mercadopagoCOP != null ? 0 : breakdown.gateway.pasarelaFixedPart,
    pasarelaIva: ov.onepayCOP != null || ov.mercadopagoCOP != null ? 0 : breakdown.gateway.pasarelaIva,
    netoOrganizador: Math.max(0, breakdown.gateway.netoOrganizador - gatewayDelta),
    pasarelaCommissionIsFinalOverride: true,
    showPasarelaCommission: true,
  };

  const pasarelaNetoOrganizador = Math.max(
    0,
    gateway.totalCobrado - breakdown.combinedTiqueteraFee - gateway.pasarelaTotal
  );

  const combined = patchCombinedPasarela(breakdown.combined, gatewayPasarelaTotal);

  return {
    ...breakdown,
    gateway,
    gatewayOnepay,
    gatewayMercadopago,
    combined,
    pasarelaNetoOrganizador,
  };
}
