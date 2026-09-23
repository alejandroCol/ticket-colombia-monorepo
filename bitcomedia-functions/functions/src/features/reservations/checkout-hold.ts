import * as admin from "firebase-admin";
import type {DocumentData} from "firebase-admin/firestore";

/**
 * Reloj del checkout (formulario / contador de 10 min) — colección ticket_reservations.
 * No aplica a quien ya está en Mercado Pago u OnePay.
 */
export const CHECKOUT_HOLD_MS = 10 * 60 * 1000;

/**
 * Quien ya inició el pago en la pasarela (ticket reserved + preference).
 * PSE / tarjeta pueden tardar más de 10 min; no se corta el cobro por unos minutos extra.
 * Si abandonan de verdad, el palco se libera después de esta ventana.
 */
export const PAYMENT_IN_PROGRESS_HOLD_MS = 60 * 60 * 1000;

/**
 * Convierte un Timestamp de Firestore a milisegundos.
 * @param {unknown} value Timestamp o valor desconocido
 * @return {number} Epoch ms o 0
 */
function timestampToMs(value: unknown): number {
  if (
    value &&
    typeof value === "object" &&
    typeof (value as {toMillis?: () => number}).toMillis === "function"
  ) {
    const n = (value as {toMillis: () => number}).toMillis();
    return typeof n === "number" && Number.isFinite(n) ? n : 0;
  }
  return 0;
}

/**
 * Ya pagó el abono (p. ej. 30%): el palco se mantiene hasta balanceDueAt.
 * No incluye awaiting_deposit (aún está pagando el 30% en la pasarela).
 * @param {DocumentData} data Documento de ticket
 * @return {boolean} true si el cupo debe seguir retenido por abono pagado
 */
export function isAbonoInventoryHold(data: DocumentData): boolean {
  const phase = String(data.installmentPhase || "none");
  if (phase === "deposit_paid" || phase === "awaiting_balance") return true;
  const deposit = Number(data.depositCOP) || 0;
  const paymentStatus = String(data.paymentStatus || "");
  return (
    deposit > 0 &&
    paymentStatus === "approved" &&
    String(data.ticketStatus || "") === "reserved"
  );
}

/**
 * Fin de la retención mientras pagan en la pasarela (60 min).
 * Tickets viejos sin holdExpiresAt: createdAt + 60 min (nunca 10 min).
 * @param {DocumentData} data Documento de ticket
 * @return {number} Epoch ms de vencimiento
 */
export function checkoutHoldExpiresAtMs(data: DocumentData): number {
  const hold = timestampToMs(data.holdExpiresAt);
  if (hold > 0) return hold;
  const created = timestampToMs(data.createdAt);
  if (created > 0) return created + PAYMENT_IN_PROGRESS_HOLD_MS;
  return 0;
}

/**
 * Hold de checkout/pasarela vencido, sin abono ya pagado.
 * @param {DocumentData} data Documento de ticket
 * @param {number} nowMs Epoch actual
 * @return {boolean} true si hay que expirar el hold
 */
export function shouldExpireUnpaidCheckoutHold(
  data: DocumentData,
  nowMs: number
): boolean {
  if (String(data.ticketStatus || "") !== "reserved") return false;
  if (isAbonoInventoryHold(data)) return false;
  if (String(data.paymentStatus || "") === "approved") return false;
  return checkoutHoldExpiresAtMs(data) <= nowMs;
}

/**
 * Un ticket `reserved` ocupa inventario si:
 * - ya pagó el abono, o
 * - sigue dentro de la ventana de pago en pasarela (60 min).
 * @param {DocumentData} data Documento de ticket
 * @param {number} nowMs Epoch actual
 * @return {boolean} true si sigue ocupando cupo
 */
export function ticketReservedOccupiesInventory(
  data: DocumentData,
  nowMs: number
): boolean {
  if (String(data.ticketStatus || data.status || "") !== "reserved") {
    return false;
  }
  if (isAbonoInventoryHold(data)) return true;
  if (String(data.paymentStatus || "") === "approved") return true;
  return checkoutHoldExpiresAtMs(data) > nowMs;
}

/**
 * Campos para marcar un hold de checkout como expirado.
 * @return {FirebaseFirestore.UpdateData<DocumentData>} Update de Firestore
 */
export function expiredCheckoutHoldUpdate(): FirebaseFirestore.UpdateData<DocumentData> {
  return {
    ticketStatus: "expired",
    paymentStatus: "cancelled",
    holdExpiredAt: admin.firestore.FieldValue.serverTimestamp(),
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
  };
}
