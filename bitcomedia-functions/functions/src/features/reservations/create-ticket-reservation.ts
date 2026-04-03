import * as functions from "firebase-functions/v1";
import * as admin from "firebase-admin";
import {
  getSectionCapacity,
  loadMergedUsedFromTicketsAndReservations,
  mapZoneSlotKey,
  mapZonesForSection,
  remainingForSection,
  seatsPerUnitForSection,
} from "./availability";

const COLLECTION = "ticket_reservations";
const HOLD_MS = 10 * 60 * 1000;

export interface CreateReservationInput {
  eventId: string;
  quantity: number;
  sectionId?: string;
  sectionName?: string;
  /** Zona de mapa (palco) cuando la localidad está dividida en varias celdas. */
  mapZoneId?: string;
  holderSessionKey?: string;
}

export const createTicketReservation = functions.https.onCall(
  async (data: CreateReservationInput, context) => {
    const eventId = data.eventId;
    const quantity = Number(data.quantity) || 0;
    const sectionId = data.sectionId?.trim() || "";
    const sectionName = data.sectionName?.trim() || "";
    const mapZoneId = data.mapZoneId?.trim() || "";
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
    let eventDoc = await db.collection("events").doc(eventId).get();
    if (!eventDoc.exists) {
      eventDoc = await db.collection("recurring_events").doc(eventId).get();
    }
    if (!eventDoc.exists) {
      throw new functions.https.HttpsError("not-found", "Evento no encontrado");
    }
    const eventData = eventDoc.data()!;

    const palcoZones =
      sectionId ? mapZonesForSection(eventData, sectionId) : [];
    const needsPalcoPick = palcoZones.length > 1;

    if (needsPalcoPick) {
      if (!mapZoneId) {
        throw new functions.https.HttpsError(
          "invalid-argument",
          "Debes elegir un palco en el mapa para esta localidad."
        );
      }
      if (!palcoZones.some((z) => z.id === mapZoneId)) {
        throw new functions.https.HttpsError(
          "invalid-argument",
          "La zona seleccionada no pertenece a esta localidad."
        );
      }
      const spu = seatsPerUnitForSection(eventData, sectionId);
      if (quantity !== spu) {
        throw new functions.https.HttpsError(
          "invalid-argument",
          `Este palco incluye ${spu} entrada(s). La cantidad debe ser ${spu}.`
        );
      }
    }

    const {capacity, key: capKey} = getSectionCapacity(
      eventData,
      sectionId || undefined,
      sectionName || undefined
    );

    const resSnap = await db
      .collection(COLLECTION)
      .where("eventId", "==", eventId)
      .where("status", "==", "active")
      .get();
    const now = Date.now();
    const merged = await loadMergedUsedFromTicketsAndReservations(
      db,
      eventId,
      eventData,
      resSnap
    );

    if (mapZoneId) {
      const usedSlot = merged[mapZoneSlotKey(mapZoneId)] ?? 0;
      if (usedSlot >= 1) {
        throw new functions.https.HttpsError(
          "failed-precondition",
          "Este palco ya está reservado o vendido."
        );
      }
    } else {
      const usedForSection = merged[capKey] ?? merged[sectionName] ?? merged[sectionId] ?? 0;
      const rem = remainingForSection(capacity, usedForSection);

      if (quantity > rem) {
        throw new functions.https.HttpsError(
          "failed-precondition",
          `No hay suficientes entradas disponibles (quedan ${rem})`
        );
      }
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
      mapZoneId: mapZoneId || null,
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
