import * as functions from "firebase-functions/v1";
import * as admin from "firebase-admin";
import {defineSecret} from "firebase-functions/params";
import {PaymentServiceFactory} from "./factories/payment-service.factory";

const mercadopagoAccessToken = defineSecret("MERCADOPAGO_ACCESS_TOKEN");
const mercadopagoWebhookSecret = defineSecret("MERCADOPAGO_WEBHOOK_SECRET");
const appUrlSecret = defineSecret("APP_URL");
const resendApiKeySecret = defineSecret("RESEND_API_KEY");
const senderEmailSecret = defineSecret("SENDER_EMAIL");
const senderNameSecret = defineSecret("SENDER_NAME");

async function loadEventDoc(eventId: string) {
  let ev = await admin.firestore().collection("events").doc(eventId).get();
  if (ev.exists) return ev;
  return admin.firestore().collection("recurring_events").doc(eventId).get();
}

/**
 * Admin, organizador del evento o partner con create_tickets / taquilla.
 * @param {string} uid UID autenticado
 * @param {string} eventId Evento del ticket
 * @return {Promise<boolean>} Si puede confirmar pago o liberar reservas
 */
export async function canConfirmManualPayment(uid: string, eventId: string): Promise<boolean> {
  const userDoc = await admin.firestore().collection("users").doc(uid).get();
  if (!userDoc.exists) return false;
  const role = String(userDoc.data()?.role || "");
  if (role === "ADMIN" || role === "admin" || role === "SUPER_ADMIN") return true;
  const ev = await loadEventDoc(eventId);
  if (!ev.exists) return false;
  const org = String(ev.data()?.organizer_id || "").trim();
  if (org === uid) return true;
  if (role !== "PARTNER") return false;
  for (const kind of ["evt", "rec"] as const) {
    const path = `event_partner_grants/${uid}_${kind}_${eventId}`;
    const g = await admin.firestore().doc(path).get();
    if (!g.exists) continue;
    const p = g.data()?.permissions as
      | {create_tickets?: boolean; taquilla_sale?: boolean}
      | undefined;
    if (p?.create_tickets === true || p?.taquilla_sale === true) return true;
  }
  return false;
}

export interface ConfirmManualTicketPaymentRequest {
  ticketId?: string;
}

/**
 * Organizador confirma que recibió el pago por otro medio (efectivo, transferencia, etc.).
 * Emite boletas y envía PDF igual que la pasarela de pago.
 */
export const confirmManualTicketPayment = functions
  .runWith({
    secrets: [
      mercadopagoAccessToken,
      mercadopagoWebhookSecret,
      appUrlSecret,
      resendApiKeySecret,
      senderEmailSecret,
      senderNameSecret,
    ],
    memory: "1GB",
    timeoutSeconds: 120,
  })
  .https.onCall(async (data: ConfirmManualTicketPaymentRequest, context) => {
    if (!context.auth?.uid) {
      throw new functions.https.HttpsError(
        "unauthenticated",
        "Inicia sesión para confirmar el pago."
      );
    }
    const ticketId = String(data?.ticketId || "").trim();
    if (!ticketId) {
      throw new functions.https.HttpsError("invalid-argument", "Falta ticketId");
    }

    const db = admin.firestore();
    const ticketSnap = await db.collection("tickets").doc(ticketId).get();
    if (!ticketSnap.exists) {
      throw new functions.https.HttpsError("not-found", "Boleto no encontrado");
    }
    const ticketData = ticketSnap.data() as Record<string, unknown>;
    const eventId = String(ticketData.eventId || "");
    if (!eventId) {
      throw new functions.https.HttpsError(
        "failed-precondition",
        "Ticket sin evento"
      );
    }

    const uid = context.auth.uid;
    const allowed = await canConfirmManualPayment(uid, eventId);
    if (!allowed) {
      throw new functions.https.HttpsError(
        "permission-denied",
        "No tienes permiso para confirmar pagos en este evento"
      );
    }

    const accessToken = mercadopagoAccessToken.value();
    const webhookSecret = mercadopagoWebhookSecret.value();
    const appUrlValue = appUrlSecret.value();
    if (!accessToken || !webhookSecret || !appUrlValue) {
      throw new functions.https.HttpsError("internal", "Pago no configurado");
    }

    const config = PaymentServiceFactory.createPaymentConfig(
      accessToken,
      webhookSecret,
      appUrlValue,
      process.env.NODE_ENV !== "production",
      undefined,
      undefined
    );
    config.resend = {
      apiKey: resendApiKeySecret.value(),
      senderEmail: senderEmailSecret.value(),
      senderName: senderNameSecret.value() || "Ticket Colombia",
    };

    const paymentService = PaymentServiceFactory.createPaymentService(config);
    try {
      const result = await paymentService.confirmManualTicketPayment(ticketId, uid);
      return {success: true, ...result};
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      throw new functions.https.HttpsError("failed-precondition", msg);
    }
  });
