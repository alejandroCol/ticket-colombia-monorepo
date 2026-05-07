import * as functions from "firebase-functions/v1";
import * as admin from "firebase-admin";
import {defineSecret} from "firebase-functions/params";
import {
  buildPurchaseTicketsPdfPayload,
  resolvePurchaseParentTicketId,
} from "./purchase-ticket-pdf-builder";
import {generateMultipleTicketsPdf} from "./pdf-generator-multiple";
import {sendTicketEmail} from "./email-sender";

const resendApiKey = defineSecret("RESEND_API_KEY");
const senderEmail = defineSecret("SENDER_EMAIL");
const senderName = defineSecret("SENDER_NAME");

async function loadEventDoc(eventId: string) {
  let ev = await admin.firestore().collection("events").doc(eventId).get();
  if (ev.exists) return ev;
  return admin.firestore().collection("recurring_events").doc(eventId).get();
}

async function canResendTicketPdf(uid: string, eventId: string): Promise<boolean> {
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
      | {read_tickets?: boolean; create_tickets?: boolean}
      | undefined;
    if (p?.read_tickets === true || p?.create_tickets === true) return true;
  }
  return false;
}

async function syncBundleBuyerEmail(
  db: admin.firestore.Firestore,
  parentId: string,
  newEmail: string
): Promise<void> {
  const pref = db.collection("tickets").doc(parentId);
  const snap = await pref.get();
  if (!snap.exists) return;
  const d = snap.data() || {};
  const ids = new Set<string>([parentId]);
  const ch = d.childTicketIds as string[] | undefined;
  if (Array.isArray(ch)) {
    ch.forEach((id) => ids.add(String(id).trim()));
  }
  const batch = db.batch();
  const ts = admin.firestore.FieldValue.serverTimestamp();
  for (const id of ids) {
    if (!id) continue;
    batch.update(db.collection("tickets").doc(id), {
      buyerEmail: newEmail,
      updatedAt: ts,
    });
  }
  await batch.commit();
}

export interface ResendTicketPdfRequest {
  ticketId?: string;
  /** Si se indica, se envía a este correo y se actualiza en el bundle (mismo comprador). */
  recipientEmail?: string;
}

/**
 * Reenvía el PDF con los QRs ya existentes (no crea tickets nuevos).
 */
export const resendTicketPdfEmail = functions
  .runWith({
    secrets: [resendApiKey, senderEmail, senderName],
    memory: "1GB",
    timeoutSeconds: 120,
  })
  .https.onCall(async (data: ResendTicketPdfRequest, context) => {
    if (!context.auth?.uid) {
      throw new functions.https.HttpsError(
        "unauthenticated",
        "Inicia sesión para reenviar el ticket."
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
    const allowed = await canResendTicketPdf(uid, eventId);
    if (!allowed) {
      throw new functions.https.HttpsError(
        "permission-denied",
        "No tienes permiso para reenviar boletos de este evento"
      );
    }

    const parentId = resolvePurchaseParentTicketId(ticketId, ticketData);
    const recipientRaw = String(data?.recipientEmail || "").trim();
    const rKey = resendApiKey.value();
    const sEmail = senderEmail.value();
    if (!rKey || !sEmail) {
      throw new functions.https.HttpsError(
        "failed-precondition",
        "Correo (Resend) no configurado en el servidor"
      );
    }

    if (recipientRaw) {
      await syncBundleBuyerEmail(db, parentId, recipientRaw);
    }

    const built = await buildPurchaseTicketsPdfPayload(parentId, db);
    if (!built) {
      throw new functions.https.HttpsError(
        "failed-precondition",
        "No hay datos de QR/PDF para este boleto (¿compra incompleta?)"
      );
    }

    let {buyerEmail} = built;
    if (recipientRaw) {
      buyerEmail = recipientRaw;
    }

    const pdfBuffer = await generateMultipleTicketsPdf(
      built.ticketsWithQR,
      built.eventData
    );
    await sendTicketEmail(
      buyerEmail,
      `Tus entradas: ${built.eventName}`,
      built.eventName,
      built.buyerName,
      pdfBuffer,
      rKey,
      sEmail,
      senderName.value() || "Ticket Colombia"
    );

    return {success: true, sentTo: buyerEmail, parentTicketId: parentId};
  });
