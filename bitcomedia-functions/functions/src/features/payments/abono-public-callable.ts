import * as functions from "firebase-functions/v1";
import * as admin from "firebase-admin";
import {FirestoreTicketRepository} from "./repositories/firestore-ticket.repository";

/**
 * Datos públicos para la pantalla "completar abono" (sin auth).
 */
export const getAbonoCheckoutPublicInfo = functions.https.onCall(async (data: { token?: string }) => {
  const token = String(data?.token || "").trim();
  if (!token || token.length < 8) {
    throw new functions.https.HttpsError("invalid-argument", "Token inválido");
  }
  const repo = new FirestoreTicketRepository();
  const ticketId = await repo.findIdByAbonoToken(token);
  if (!ticketId) {
    throw new functions.https.HttpsError("not-found", "Enlace no válido o expirado");
  }
  const snap = await admin.firestore().collection("tickets").doc(ticketId).get();
  if (!snap.exists) {
    throw new functions.https.HttpsError("not-found", "Compra no encontrada");
  }
  const t = snap.data()!;
  const phase = String(t.installmentPhase || "");
  if (phase === "forfeited" || phase === "completed") {
    throw new functions.https.HttpsError(
      "failed-precondition",
      phase === "completed" ? "Esta compra ya está pagada en su totalidad." : "Esta reserva fue liberada por vencimiento."
    );
  }
  if (phase !== "deposit_paid" && phase !== "awaiting_balance") {
    throw new functions.https.HttpsError(
      "failed-precondition",
      "No hay saldo pendiente en esta compra."
    );
  }
  const meta = t.metadata as { eventName?: string } | undefined;
  const due = t.balanceDueAt as admin.firestore.Timestamp | undefined;
  return {
    ticketId,
    eventName: meta?.eventName || "Evento",
    balanceCOP: Math.round(Number(t.balanceCOP) || 0),
    depositCOP: Math.round(Number(t.depositCOP) || 0),
    totalCOP: Math.round(Number(t.totalPurchaseCOP) || 0),
    balanceDueAtMs: due?.toMillis?.() ?? null,
    phase,
    buyerEmail: String(t.buyerEmail || "").trim(),
  };
});
