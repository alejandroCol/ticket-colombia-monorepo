import * as functions from "firebase-functions/v1";
import * as admin from "firebase-admin";
import type {DocumentData} from "firebase-admin/firestore";
import {
  loadMergedUsedFromTicketsAndReservations,
  partitionMergedSlots,
} from "../reservations/availability";

export interface AvailabilityResponse {
  /** Tickets + reservas activas (hold 10 min) por sección */
  bySection: Record<string, number>;
  /** Ocupación por id de zona de mapa (palcos divididos); cada clave suele ser 0 o 1. */
  byMapZone: Record<string, number>;
  totalSold: number;
  generalSold: number;
}

async function loadEventForAvailability(
  db: admin.firestore.Firestore,
  eventId: string | undefined,
  slug: string | undefined
): Promise<{resolvedId: string; eventData: DocumentData}> {
  if (eventId && String(eventId).trim()) {
    const id = String(eventId).trim();
    let eventDoc = await db.collection("events").doc(id).get();
    if (!eventDoc.exists) {
      eventDoc = await db.collection("recurring_events").doc(id).get();
    }
    if (!eventDoc.exists) {
      throw new functions.https.HttpsError("not-found", "Evento no encontrado");
    }
    return {resolvedId: eventDoc.id, eventData: eventDoc.data()!};
  }
  if (slug && String(slug).trim()) {
    const s = String(slug).trim();
    for (const coll of ["events", "recurring_events"] as const) {
      const q = await db
        .collection(coll)
        .where("slug", "==", s)
        .limit(1)
        .get();
      if (!q.empty) {
        const doc = q.docs[0];
        return {resolvedId: doc.id, eventData: doc.data()};
      }
    }
    throw new functions.https.HttpsError("not-found", "Evento no encontrado");
  }
  throw new functions.https.HttpsError(
    "invalid-argument",
    "eventId o slug es requerido"
  );
}

export const getEventAvailability = functions.https.onCall(
  async (data: { eventId?: string; slug?: string }, context) => {
    const rawId = data?.eventId;
    const rawSlug = data?.slug;
    const eventId =
      typeof rawId === "string" && rawId.trim() ? rawId.trim() : undefined;
    const slug =
      typeof rawSlug === "string" && rawSlug.trim() ? rawSlug.trim() : undefined;

    if (!eventId && !slug) {
      throw new functions.https.HttpsError(
        "invalid-argument",
        "eventId o slug es requerido"
      );
    }

    const db = admin.firestore();

    const {resolvedId, eventData} = await loadEventForAvailability(
      db,
      eventId,
      slug
    );

    const merged = await loadMergedUsedFromTicketsAndReservations(
      db,
      resolvedId,
      eventData
    );
    const {bySection, byMapZone} = partitionMergedSlots(merged);

    let totalSold = 0;
    Object.values(merged).forEach((n) => {
      totalSold += n;
    });

    return {
      bySection,
      byMapZone,
      totalSold,
      generalSold: bySection["General"] || 0,
    } as AvailabilityResponse;
  }
);
