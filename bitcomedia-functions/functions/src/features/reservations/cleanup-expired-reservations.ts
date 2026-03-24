import * as functions from "firebase-functions/v1";
import * as admin from "firebase-admin";

const COLLECTION = "ticket_reservations";

/**
 * Marca reservas activas expiradas como "expired" (cada 5 minutos).
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
    console.log(`[cleanupExpiredReservations] Marcadas ${n} reservas expiradas`);
    return null;
  });
