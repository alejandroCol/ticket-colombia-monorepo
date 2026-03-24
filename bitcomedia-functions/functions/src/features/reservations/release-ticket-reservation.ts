import * as functions from "firebase-functions/v1";
import * as admin from "firebase-admin";

const COLLECTION = "ticket_reservations";

export interface ReleaseInput {
  reservationId: string;
  holderSessionKey?: string;
}

export const releaseTicketReservation = functions.https.onCall(
  async (data: ReleaseInput, context) => {
    const reservationId = data.reservationId?.trim();
    if (!reservationId) {
      throw new functions.https.HttpsError(
        "invalid-argument",
        "reservationId requerido"
      );
    }

    const holderUid = context.auth?.uid || "";
    const holderSessionKey = data.holderSessionKey?.trim() || "";

    const db = admin.firestore();
    const ref = db.collection(COLLECTION).doc(reservationId);
    const snap = await ref.get();
    if (!snap.exists) {
      return {released: false};
    }

    const r = snap.data()!;
    if (r.status !== "active") {
      return {released: false};
    }

    const ok =
      (holderUid && r.holderUid === holderUid) ||
      (holderSessionKey && r.holderSessionKey === holderSessionKey);
    if (!ok) {
      throw new functions.https.HttpsError(
        "permission-denied",
        "No puedes liberar esta reserva"
      );
    }

    await ref.update({
      status: "released",
      releasedAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    return {released: true};
  }
);
