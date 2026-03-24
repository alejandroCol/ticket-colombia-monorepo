import * as functions from "firebase-functions/v1";
import * as admin from "firebase-admin";
import {
  countTicketsBySection,
  countActiveReservationsBySection,
  getSectionCapacity,
  mergedUsedBySection,
  remainingForSection,
} from "./availability";

const COLLECTION = "ticket_reservations";
const HOLD_MS = 10 * 60 * 1000;

export interface CreateReservationInput {
  eventId: string;
  quantity: number;
  sectionId?: string;
  sectionName?: string;
  holderSessionKey?: string;
}

export const createTicketReservation = functions.https.onCall(
  async (data: CreateReservationInput, context) => {
    const eventId = data.eventId;
    const quantity = Number(data.quantity) || 0;
    const sectionId = data.sectionId?.trim() || "";
    const sectionName = data.sectionName?.trim() || "";
    const holderUid = context.auth?.uid || "";
    const holderSessionKey = data.holderSessionKey?.trim() || "";

    if (!eventId || quantity < 1) {
      throw new functions.https.HttpsError(
        "invalid-argument",
        "eventId y quantity válidos son requeridos"
      );
    }

    if (!holderUid && !holderSessionKey) {
      throw new functions.https.HttpsError(
        "invalid-argument",
        "Sesión inválida: recarga la página"
      );
    }

    const db = admin.firestore();
    const eventDoc = await db.collection("events").doc(eventId).get();
    if (!eventDoc.exists) {
      throw new functions.https.HttpsError("not-found", "Evento no encontrado");
    }
    const eventData = eventDoc.data()!;

    const {capacity, key: capKey} = getSectionCapacity(
      eventData,
      sectionId || undefined,
      sectionName || undefined
    );

    const [ticketsSnap, resSnap] = await Promise.all([
      db.collection("tickets").where("eventId", "==", eventId).get(),
      db.collection(COLLECTION).where("eventId", "==", eventId).where("status", "==", "active").get(),
    ]);

    const now = Date.now();
    const {bySection: tBy} = countTicketsBySection(ticketsSnap);
    const {bySection: rBy} = countActiveReservationsBySection(resSnap, now);
    const merged = mergedUsedBySection(tBy, rBy);

    const usedForSection = merged[capKey] ?? merged[sectionName] ?? merged[sectionId] ?? 0;
    const rem = remainingForSection(capacity, usedForSection);

    if (quantity > rem) {
      throw new functions.https.HttpsError(
        "failed-precondition",
        `No hay suficientes entradas disponibles (quedan ${rem})`
      );
    }

    const batch = db.batch();
    resSnap.forEach((doc) => {
      const r = doc.data();
      if (r.status !== "active") return;
      if (r.expiresAt?.toMillis?.() <= now) return;
      const sameHolder =
        (holderUid && r.holderUid === holderUid) ||
        (holderSessionKey && r.holderSessionKey === holderSessionKey);
      if (sameHolder) {
        batch.update(doc.ref, {
          status: "superseded",
          supersededAt: admin.firestore.FieldValue.serverTimestamp(),
        });
      }
    });

    const newRef = db.collection(COLLECTION).doc();
    const expiresAt = admin.firestore.Timestamp.fromMillis(now + HOLD_MS);

    batch.set(newRef, {
      eventId,
      quantity,
      sectionId: sectionId || null,
      sectionName: capKey,
      holderUid: holderUid || null,
      holderSessionKey: holderSessionKey || null,
      status: "active",
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      expiresAt,
    });

    await batch.commit();

    return {
      reservationId: newRef.id,
      expiresAt: expiresAt.toMillis(),
      holdMinutes: 10,
    };
  }
);
