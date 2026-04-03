import * as functions from "firebase-functions/v1";
import * as admin from "firebase-admin";

/**
 * Libera reservas de abono no completadas tras vencer balanceDueAt.
 */
export const expirePendingInstallments = functions.pubsub
  .schedule("every 60 minutes")
  .onRun(async () => {
    const db = admin.firestore();
    const now = admin.firestore.Timestamp.now();
    const snap = await db
      .collection("tickets")
      .where("installmentPhase", "==", "deposit_paid")
      .where("balanceDueAt", "<", now)
      .limit(200)
      .get();

    if (snap.empty) {
      console.log("[expirePendingInstallments] Sin abonos vencidos");
      return null;
    }

    const batch = db.batch();
    let n = 0;
    snap.forEach((doc) => {
      batch.update(doc.ref, {
        installmentPhase: "forfeited",
        ticketStatus: "cancelled",
        paymentStatus: "cancelled",
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      });
      n++;
    });
    await batch.commit();
    console.log(`[expirePendingInstallments] Marcados ${n} abonos vencidos`);
    return null;
  });
