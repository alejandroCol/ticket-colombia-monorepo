import * as functions from "firebase-functions/v1";
import * as admin from "firebase-admin";
import type {DocumentData} from "firebase-admin/firestore";
import {canConfirmManualPayment} from "./confirm-manual-ticket-payment";
import {isAbonoInventoryHold} from "../reservations/checkout-hold";

export interface ReleaseReservedTicketRequest {
  ticketId?: string;
}

/**
 * Organizador/admin libera un palco o cupo retenido en checkout sin pago.
 * No aplica a abonos con depósito ya pagado.
 */
export const releaseReservedTicket = functions.https.onCall(
  async (data: ReleaseReservedTicketRequest, context) => {
    if (!context.auth?.uid) {
      throw new functions.https.HttpsError(
        "unauthenticated",
        "Inicia sesión para liberar la reserva."
      );
    }
    const ticketId = String(data?.ticketId || "").trim();
    if (!ticketId) {
      throw new functions.https.HttpsError("invalid-argument", "Falta ticketId");
    }

    const db = admin.firestore();
    const ref = db.collection("tickets").doc(ticketId);
    const snap = await ref.get();
    if (!snap.exists) {
      throw new functions.https.HttpsError("not-found", "Boleto no encontrado");
    }
    const ticketData = (snap.data() || {}) as DocumentData;
    const eventId = String(ticketData.eventId || "");
    if (!eventId) {
      throw new functions.https.HttpsError(
        "failed-precondition",
        "Ticket sin evento"
      );
    }

    const allowed = await canConfirmManualPayment(context.auth.uid, eventId);
    if (!allowed) {
      throw new functions.https.HttpsError(
        "permission-denied",
        "No tienes permiso para liberar reservas en este evento"
      );
    }

    const status = String(ticketData.ticketStatus || "");
    if (status === "cancelled" || status === "disabled" || status === "expired") {
      return {released: true, alreadyFree: true};
    }
    if (status !== "reserved") {
      throw new functions.https.HttpsError(
        "failed-precondition",
        "Solo se pueden liberar boletos en reserva (sin pago confirmado)."
      );
    }
    if (isAbonoInventoryHold(ticketData)) {
      throw new functions.https.HttpsError(
        "failed-precondition",
        "Este cupo corresponde a un abono con depósito pagado. No se puede liberar desde aquí."
      );
    }

    await ref.update({
      ticketStatus: "cancelled",
      paymentStatus: "cancelled",
      holdReleasedBy: context.auth.uid,
      holdReleasedAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    return {released: true, alreadyFree: false};
  }
);
