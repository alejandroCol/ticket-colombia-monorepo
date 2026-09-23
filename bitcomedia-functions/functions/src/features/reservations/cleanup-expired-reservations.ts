import * as functions from "firebase-functions/v1";
import * as admin from "firebase-admin";
import {
  expiredCheckoutHoldUpdate,
  shouldExpireUnpaidCheckoutHold,
} from "./checkout-hold";

const COLLECTION = "ticket_reservations";

/**
 * Marca tickets reserved de checkout vencidos (sin abono pagado).
 * @param {admin.firestore.Firestore} db Firestore
 * @return {Promise<number>} Cantidad actualizada
 */
async function expireCheckoutHoldTickets(
  db: admin.firestore.Firestore
): Promise<number> {
  const nowMs = Date.now();
  const snap = await db
    .collection("tickets")
    .where("ticketStatus", "==", "reserved")
    .limit(500)
    .get();

  const batch = db.batch();
  let n = 0;
  snap.forEach((doc) => {
    if (!shouldExpireUnpaidCheckoutHold(doc.data(), nowMs)) return;
    batch.update(doc.ref, expiredCheckoutHoldUpdate());
    n++;
  });
  if (n > 0) {
    await batch.commit();
  }
  return n;
}

/**
 * Marca reservas de formulario (10 min) y tickets abandonados en pasarela (60 min).
 * No toca abonos con depósito ya pagado. La disponibilidad ignora holds vencidos al instante.
 */
export const cleanupExpiredReservations = functions.pubsub
  .schedule("every 5 minutes")
  .onRun(async () => {
    const db = admin.firestore();
    const now = admin.firestore.Timestamp.now();
    const snap = await db
      .collection(COLLECTION)
      .where("status", "==", "active")
      .limit(500)
      .get();

    const batch = db.batch();
    let n = 0;
    snap.forEach((doc) => {
      const exp = doc.data().expiresAt;
      if (!exp || exp.toMillis() > now.toMillis()) return;
      batch.update(doc.ref, {
        status: "expired",
        expiredAt: admin.firestore.FieldValue.serverTimestamp(),
      });
      n++;
    });

    if (n > 0) {
      await batch.commit();
    }

    const ticketN = await expireCheckoutHoldTickets(db);
    console.log(
      `[cleanupExpiredReservations] Reservas expiradas=${n} tickets hold expirados=${ticketN}`
    );
    return null;
  });
