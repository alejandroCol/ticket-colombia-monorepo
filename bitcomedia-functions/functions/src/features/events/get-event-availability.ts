import * as functions from "firebase-functions/v1";
import * as admin from "firebase-admin";
import {
  countTicketsBySection,
  countActiveReservationsBySection,
  mergedUsedBySection,
} from "../reservations/availability";

export interface AvailabilityResponse {
  /** Tickets + reservas activas (hold 10 min) por sección */
  bySection: Record<string, number>;
  totalSold: number;
  generalSold: number;
}

export const getEventAvailability = functions.https.onCall(
  async (data: { eventId: string }, context) => {
    const { eventId } = data;
    if (!eventId || typeof eventId !== "string") {
      throw new functions.https.HttpsError(
        "invalid-argument",
        "eventId es requerido"
      );
    }

    const db = admin.firestore();
    const now = Date.now();

    const [ticketsSnap, resSnap] = await Promise.all([
      db.collection("tickets").where("eventId", "==", eventId).get(),
      db
        .collection("ticket_reservations")
        .where("eventId", "==", eventId)
        .where("status", "==", "active")
        .get(),
    ]);

    const {bySection: tBy} = countTicketsBySection(ticketsSnap);
    const {bySection: rBy} = countActiveReservationsBySection(resSnap, now);
    const bySection = mergedUsedBySection(tBy, rBy);

    let totalSold = 0;
    Object.values(bySection).forEach((n) => {
      totalSold += n;
    });

    return {
      bySection,
      totalSold,
      generalSold: bySection["General"] || 0,
    } as AvailabilityResponse;
  }
);
