import type { GatewayWithdrawal } from '@services/firestore';
import type { SalesChannelBreakdown } from '@utils/salesChannelBreakdown';
import { ONEPAY_PASARELA_COMMISSION_DISCLAIMER } from '@utils/salesChannelBreakdown';

export type PasarelaProviderSaldo = {
  provider: 'onepay' | 'mercadopago';
  label: string;
  recaudadoCOP: number;
  tarifaTiqueteraCOP: number;
  comisionPasarelaCOP: number;
  retirosCOP: number;
  saldoEstimadoCOP: number;
  showPasarelaCommissionEstimate: boolean;
  commissionIsFinal: boolean;
};

export type EventPasarelaBalances = {
  providers: PasarelaProviderSaldo[];
  /** Neto taquilla / manual (no está en pasarela). */
  manualFueraPasarelaCOP: number;
  /** Tarifa tiquetera descontada del neto manual (sin cobros en línea). */
  tiqueteraEnManualCOP: number;
};

function sumWithdrawals(withdrawals: GatewayWithdrawal[], provider: 'onepay' | 'mercadopago'): number {
  return withdrawals.reduce((s, w) => {
    const p = String(w.provider || 'onepay').toLowerCase();
    if (provider === 'onepay' && (p === 'onepay' || p === 'other' || !w.provider)) return s + (w.amount || 0);
    if (provider === 'mercadopago' && p === 'mercadopago') return s + (w.amount || 0);
    return s;
  }, 0);
}

/**
 * Cuánto debería quedar en cada pasarela: recaudado − tarifa tiquetera (según reglas) − comisión OnePay − retiros.
 * Si hay OnePay, la tarifa tiquetera total del evento se descuenta de OnePay; si solo hay Mercado Pago en línea, de MP.
 */
export function computeEventPasarelaBalances(
  breakdown: SalesChannelBreakdown,
  withdrawals: GatewayWithdrawal[]
): EventPasarelaBalances {
  const retirosOnepay = sumWithdrawals(withdrawals, 'onepay');
  const retirosMp = sumWithdrawals(withdrawals, 'mercadopago');

  const onepayRec = breakdown.gatewayOnepay.totalCobrado;
  const mpRec = breakdown.gatewayMercadopago.totalCobrado;
  const onepayUnits = breakdown.gatewayOnepay.ticketUnits;
  const mpUnits = breakdown.gatewayMercadopago.ticketUnits;
  const tiqueteraTotal = breakdown.combinedTiqueteraFee;

  const onlyMpInPasarela = onepayUnits === 0 && mpUnits > 0;

  let tiqueteraOnOnepay = 0;
  let tiqueteraOnMp = 0;
  if (tiqueteraTotal > 0) {
    if (onlyMpInPasarela) {
      tiqueteraOnMp = tiqueteraTotal;
    } else if (onepayUnits > 0) {
      tiqueteraOnOnepay = tiqueteraTotal;
    } else if (mpUnits > 0) {
      tiqueteraOnMp = tiqueteraTotal;
    }
  }

  const tiqueteraEnManual = Math.max(0, tiqueteraTotal - tiqueteraOnOnepay - tiqueteraOnMp);
  const showOnepayComm = breakdown.gatewayOnepay.showPasarelaCommission;

  const providers: PasarelaProviderSaldo[] = [];

  if (onepayUnits > 0 || tiqueteraOnOnepay > 0 || retirosOnepay > 0) {
    const comm = breakdown.gatewayOnepay.pasarelaTotal;
    providers.push({
      provider: 'onepay',
      label: 'OnePay',
      recaudadoCOP: onepayRec,
      tarifaTiqueteraCOP: tiqueteraOnOnepay,
      comisionPasarelaCOP: comm,
      retirosCOP: retirosOnepay,
      saldoEstimadoCOP: Math.max(0, onepayRec - tiqueteraOnOnepay - comm - retirosOnepay),
      showPasarelaCommissionEstimate: showOnepayComm,
      commissionIsFinal: breakdown.gatewayOnepay.pasarelaCommissionIsFinalOverride === true,
    });
  }

  if (mpUnits > 0 || tiqueteraOnMp > 0 || retirosMp > 0) {
    const mpComm = breakdown.gatewayMercadopago.pasarelaTotal;
    providers.push({
      provider: 'mercadopago',
      label: 'Mercado Pago',
      recaudadoCOP: mpRec,
      tarifaTiqueteraCOP: tiqueteraOnMp,
      comisionPasarelaCOP: mpComm,
      retirosCOP: retirosMp,
      saldoEstimadoCOP: Math.max(0, mpRec - tiqueteraOnMp - mpComm - retirosMp),
      showPasarelaCommissionEstimate: true,
      commissionIsFinal: breakdown.gatewayMercadopago.pasarelaCommissionIsFinalOverride === true,
    });
  }

  return {
    providers,
    manualFueraPasarelaCOP: breakdown.manual.netoOrganizador,
    tiqueteraEnManualCOP: tiqueteraEnManual,
  };
}

export { ONEPAY_PASARELA_COMMISSION_DISCLAIMER };
