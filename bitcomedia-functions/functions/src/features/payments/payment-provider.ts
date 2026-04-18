import * as admin from "firebase-admin";
import type {DocumentData} from "firebase-admin/firestore";

/**
 * Pasarela de pago por evento (Firestore `events` / `recurring_events`).
 * Sin campo o valor desconocido → **onepay** (compatibilidad con eventos antiguos).
 */
export function paymentProviderFromEventData(
  eventData: DocumentData | undefined | null
): "onepay" | "mercadopago" {
  const raw = String(eventData?.payment_provider ?? "").trim().toLowerCase();
  if (raw === "mercadopago") return "mercadopago";
  return "onepay";
}

/**
 * Resuelve la pasarela leyendo el documento del evento (puntual o recurrente).
 */
export async function resolvePaymentProviderForEventId(
  eventId: string
): Promise<"onepay" | "mercadopago"> {
  const id = String(eventId || "").trim();
  if (!id) return "onepay";
  const db = admin.firestore();
  let snap = await db.collection("events").doc(id).get();
  if (!snap.exists) {
    snap = await db.collection("recurring_events").doc(id).get();
  }
  if (!snap.exists) return "onepay";
  return paymentProviderFromEventData(snap.data());
}
