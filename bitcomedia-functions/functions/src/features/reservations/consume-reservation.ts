import * as admin from "firebase-admin";
import type {CreateTicketRequest} from "../payments/types";

const COLLECTION = "ticket_reservations";

export async function consumeReservation(
  db: admin.firestore.Firestore,
  reservationId: string,
  request: CreateTicketRequest
): Promise<void> {
  const ref = db.collection(COLLECTION).doc(reservationId);

  await db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    if (!snap.exists) {
      throw new Error("Reserva no encontrada. Vuelve al evento e intenta de nuevo.");
    }
    const r = snap.data()!;
    if (r.status !== "active") {
      throw new Error("Esta reserva ya no es válida. Actualiza la página.");
    }
    const now = Date.now();
    const expMs = r.expiresAt?.toMillis?.() ?? 0;
    if (!expMs || expMs <= now) {
      throw new Error("Tu reserva de 10 minutos expiró. Vuelve a reservar.");
    }
    if (r.eventId !== request.eventId) {
      throw new Error("La reserva no corresponde a este evento.");
    }
    if (Number(r.quantity) !== Number(request.quantity)) {
      throw new Error("La cantidad no coincide con tu reserva.");
    }

    const reqSid = String(request.metadata?.sectionId || "").trim();
    const reqSname = String(request.metadata?.seatNumber || "General").trim();
    const rSid = String(r.sectionId || "").trim();
    const rSname = String(r.sectionName || "General").trim();

    if (rSid !== reqSid || rSname !== reqSname) {
      throw new Error("La localidad no coincide con tu reserva.");
    }

    tx.update(ref, {
      status: "consumed",
      consumedAt: admin.firestore.FieldValue.serverTimestamp(),
    });
  });
}

export async function restoreReservationActive(
  db: admin.firestore.Firestore,
  reservationId: string,
  holdMs: number
): Promise<void> {
  const ref = db.collection(COLLECTION).doc(reservationId);
  await db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    if (!snap.exists) return;
    const r = snap.data()!;
    if (r.status !== "consumed") return;
    tx.update(ref, {
      status: "active",
      expiresAt: admin.firestore.Timestamp.fromMillis(Date.now() + holdMs),
      restoredAt: admin.firestore.FieldValue.serverTimestamp(),
    });
  });
}
