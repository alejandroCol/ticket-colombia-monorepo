import type { Ticket } from '@services/types';

function ticketIsManualLikeLocal(t: Ticket): boolean {
  if ((t as { createdByAdmin?: string }).createdByAdmin) return true;
  const pm = String(t.paymentMethod || '').toLowerCase();
  return pm === 'manual' || pm === 'transfer' || pm === 'free' || pm === 'admin_manual';
}

function ticketUsesMercadoPagoCheckoutLocal(t: Ticket): boolean {
  const pref = String(t.preferenceId || '').trim();
  if (/^3526506746-/i.test(pref)) return true;
  const pm = String(t.paymentMethod || '').toLowerCase();
  return pm.includes('mercadopago');
}

/** UUID OnePay o preferencia Mercado Pago legacy. */
export function isGatewayPaymentReference(ref: string): boolean {
  const r = ref.trim();
  if (!r || r.startsWith('transfer_')) return false;
  if (/^3526506746-/i.test(r)) return true;
  return /^[0-9a-f]{8}-[0-9a-f]{4}-/i.test(r);
}

/**
 * Id de cobro en pasarela para conciliación (sigue `transferredFrom` si el doc tiene `transfer_*`).
 */
export function ticketGatewayPaymentReference(t: Ticket): string {
  const pref = String(t.preferenceId ?? '').trim();
  const pay = String(t.paymentId ?? '').trim();
  if (isGatewayPaymentReference(pref)) return pref;
  if (isGatewayPaymentReference(pay)) return pay;
  return pref || pay;
}

export function ticketWasReissuedAfterTransfer(t: Ticket): boolean {
  return Boolean(String((t as { transferredFrom?: string }).transferredFrom || '').trim());
}

function isOnepayUuid(ref: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-/i.test(ref.trim());
}

/**
 * Venta manual/taquilla vinculada a un cobro OnePay (conciliación / ajuste de cuentas).
 */
export function ticketHasLinkedOnepayPayment(t: Ticket): boolean {
  if (!ticketIsManualLikeLocal(t)) return false;
  if (ticketUsesMercadoPagoCheckoutLocal(t)) return false;
  return isOnepayUuid(ticketGatewayPaymentReference(t));
}

/** Boleto que debe aparecer en el bloque OnePay al conciliar con la pasarela. */
export function ticketReconcilesWithOnepay(t: Ticket): boolean {
  if (ticketUsesMercadoPagoCheckoutLocal(t)) return false;
  const ref = ticketGatewayPaymentReference(t);
  if (!isOnepayUuid(ref)) return false;
  if (ticketIsManualLikeLocal(t)) return ticketHasLinkedOnepayPayment(t);
  return Math.round(Number(t.amount) || 0) > 0;
}
