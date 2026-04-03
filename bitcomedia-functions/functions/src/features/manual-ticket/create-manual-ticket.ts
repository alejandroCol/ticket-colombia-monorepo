import * as functions from "firebase-functions/v1";
import * as admin from "firebase-admin";
import {defineSecret} from "firebase-functions/params";
import {capacityBucketAndCount} from "../reservations/availability";
import {generateMultipleTicketsPdf} from "./pdf-generator-multiple";
import {sendTicketEmail} from "./email-sender";
import {randomUUID} from "crypto";
import QRCode from "qrcode";

// Definir secretos para el envío de correos
const resendApiKey = defineSecret("RESEND_API_KEY");
const senderEmail = defineSecret("SENDER_EMAIL");
const senderName = defineSecret("SENDER_NAME");
const adminUrlSecret = defineSecret("ADMIN_URL");

/**
 * Admin de panel o partner:
 * - Cortesías (isCourtesy): solo create_tickets
 * - Venta a precio público: create_tickets o taquilla_sale
 */
async function canCreateManualTicket(uid: string, eventId: string, isCourtesy: boolean): Promise<boolean> {
  const adminUserDoc = await admin.firestore().collection("users").doc(uid).get();
  if (!adminUserDoc.exists) return false;
  const role = adminUserDoc.data()?.role as string | undefined;
  if (role === "ADMIN" || role === "admin" || role === "SUPER_ADMIN") return true;
  if (role !== "PARTNER") return false;
  let hasCreate = false;
  let hasTaquilla = false;
  for (const kind of ["evt", "rec"] as const) {
    const path = `event_partner_grants/${uid}_${kind}_${eventId}`;
    const g = await admin.firestore().doc(path).get();
    if (!g.exists) continue;
    const p = g.data()?.permissions as { create_tickets?: boolean; taquilla_sale?: boolean } | undefined;
    if (p?.create_tickets === true) hasCreate = true;
    if (p?.taquilla_sale === true) hasTaquilla = true;
  }
  if (isCourtesy) return hasCreate;
  return hasCreate || hasTaquilla;
}

async function loadEventDocForManualTicket(eventId: string) {
  const eventDoc = await admin.firestore().collection("events").doc(eventId).get();
  if (eventDoc.exists) return eventDoc;
  const recDoc = await admin.firestore().collection("recurring_events").doc(eventId).get();
  if (recDoc.exists) return recDoc;
  return null;
}

interface CreateManualTicketRequest {
  eventId: string;
  buyerName: string;
  buyerEmail: string;
  buyerPhone?: string;
  buyerIdNumber?: string;
  quantity: number;
  sectionId?: string;
  sectionName?: string;
  /** Si es true, el ticket es de cortesía (valor $0) y no suma en ingresos */
  isCourtesy?: boolean;
  /** Si es true, es cortesía del evento general (sin donante específico) */
  isGeneralCourtesy?: boolean;
  /** Quien regala la cortesía (cuando isGeneralCourtesy es false) */
  giftedBy?: string;
}

/**
 * Firebase Function para crear tickets manuales (sin pago)
 * Llamada por administradores desde el panel admin
 */
export const createManualTicket = functions
  .runWith({
    secrets: [resendApiKey, senderEmail, senderName, adminUrlSecret],
    timeoutSeconds: 60,
    memory: "1GB",
  })
  .https.onCall(async (data: CreateManualTicketRequest, context) => {
    console.log("[createManualTicket] Llamada recibida", {
      hasAuth: !!context.auth,
      eventId: data?.eventId,
      quantity: data?.quantity,
      buyerEmail: data?.buyerEmail,
      isCourtesy: data?.isCourtesy,
    });
    try {
      // 1. Autenticación y Autorización
      if (!context.auth) {
        throw new functions.https.HttpsError(
          "unauthenticated",
          "La función debe ser llamada por un usuario autenticado."
        );
      }

      const adminUid = context.auth.uid;

      // 2. Validación de Datos de Entrada
      const {eventId, buyerName, buyerEmail, buyerPhone, buyerIdNumber, quantity, sectionId, sectionName, isCourtesy, isGeneralCourtesy, giftedBy} = data;

      if (!eventId || !buyerName || !buyerEmail || !quantity || quantity <= 0) {
        throw new functions.https.HttpsError(
          "invalid-argument",
          "Faltan campos requeridos: eventId, buyerName, buyerEmail, quantity."
        );
      }
      console.log("[createManualTicket] Validación OK");

      const allowed = await canCreateManualTicket(adminUid, eventId, !!isCourtesy);
      if (!allowed) {
        throw new functions.https.HttpsError(
          "permission-denied",
          "No tienes permiso para crear boletos manuales en este evento."
        );
      }
      console.log("[createManualTicket] Auth OK, uid:", context.auth.uid);

      // 3. Obtener Información del Evento
      console.log("[createManualTicket] Leyendo evento:", eventId);
      const eventDoc = await loadEventDocForManualTicket(eventId);
      if (!eventDoc?.exists) {
        throw new functions.https.HttpsError("not-found", "Evento no encontrado.");
      }
      const eventData = eventDoc.data() as admin.firestore.DocumentData;
      console.log("[createManualTicket] Evento OK:", eventData?.name);

      // Determinar precio: cortesía = 0, sino basado en sección o precio por defecto
      let ticketPrice = eventData.ticket_price;
      if (isCourtesy) {
        ticketPrice = 0;
      } else if (sectionId && eventData.sections && Array.isArray(eventData.sections)) {
        const selectedSection = eventData.sections.find((s: any) => s.id === sectionId);
        if (selectedSection) {
          ticketPrice = selectedSection.price;
        }
      }

      let seatsPerUnit = 1;
      if (sectionId && eventData.sections && Array.isArray(eventData.sections)) {
        const sel = eventData.sections.find((s: any) => s.id === sectionId);
        if (sel) {
          seatsPerUnit = Math.max(1, Number(sel.seats_per_unit) || 1);
        }
      }
      const totalPasses = quantity * seatsPerUnit;
      const revenueTotal =
        Number(ticketPrice) * quantity * (isCourtesy ? 0 : 1);
      const isBundle = seatsPerUnit > 1;
      const bundleLeaderId = isBundle ? randomUUID() : "";

      const ticketsToCreate = [];
      for (let i = 0; i < totalPasses; i++) {
        const ticketId = isBundle && i === 0 ? bundleLeaderId : randomUUID();
        const adminUrl = adminUrlSecret.value().trim();
        const qrCodeData = `${adminUrl}/validate-ticket/${ticketId}`;

        const lineAmount = isCourtesy ?
          0 :
          isBundle ?
            (i === 0 ? revenueTotal : 0) :
            ticketPrice;

        const ticketData = {
          ticketId: ticketId,
          eventId: eventId,
          eventName: eventData.name,
          eventDate: eventData.date,
          eventTime: eventData.time,
          eventVenue: eventData.venue?.name || eventData.venue?.address || "Venue no especificado",
          city: eventData.city,
          buyerName: buyerName,
          buyerEmail: buyerEmail,
          buyerPhone: buyerPhone || null,
          buyerIdNumber: buyerIdNumber || null,
          price: isBundle ? (i === 0 ? ticketPrice : 0) : ticketPrice,
          currency: "COP",
          status: "approved",
          paymentMethod: "manual",
          sectionId: sectionId || null,
          sectionName: sectionName || null,
          mapZoneId: "",
          transferredTo: null,
          ticketStatus: "paid",
          quantity: isBundle ? (i === 0 ? quantity : 1) : 1,
          amount: lineAmount,
          purchaseAmount: lineAmount,
          ...(isBundle && i > 0 ? {bundleParentTicketId: bundleLeaderId} : {}),
          ...(isBundle ?
            {
              ticketKind: i === 0 ? "purchase_bundle_parent" : "purchase_pass",
              passIndex: i + 1,
              passCount: totalPasses,
            } :
            {ticketKind: "standard"}),
          ...capacityBucketAndCount({
            mapZoneId: "",
            sectionId: sectionId || null,
            sectionName: sectionName || null,
            quantity: isBundle ? (i === 0 ? quantity : 1) : 1,
            ticketKind: isBundle ?
              (i === 0 ? "purchase_bundle_parent" : "purchase_pass") :
              "standard",
          }),
          isCourtesy: !!isCourtesy,
          isGeneralCourtesy: !!isGeneralCourtesy,
          giftedBy: giftedBy?.trim() || null,
          createdAt: admin.firestore.FieldValue.serverTimestamp(),
          validatedAt: null,
          validatedBy: null,
          qrCodeData: qrCodeData,
          createdByAdmin: adminUid,
        };
        ticketsToCreate.push(ticketData);
      }
      console.log("[createManualTicket] Tickets en memoria:", ticketsToCreate.length, "precio:", ticketPrice);

      // 5. Guardar Tickets en Firestore
      console.log("[createManualTicket] Guardando batch en Firestore...");
      const batch = admin.firestore().batch();
      ticketsToCreate.forEach((ticket) => {
        const ticketDocRef = admin.firestore().collection("tickets").doc(ticket.ticketId);
        batch.set(ticketDocRef, ticket);
      });
      await batch.commit();
      console.log("[createManualTicket] Batch Firestore OK");

      try {
        const authEmail = (context.auth?.token?.email as string | undefined) || "";
        await admin.firestore().collection("audit_logs").add({
          actorUid: adminUid,
          actorEmail: (authEmail || "").slice(0, 320),
          kind: "manual_ticket_batch",
          action: "create",
          entityType: "ticket",
          entityId: ticketsToCreate.map((t) => t.ticketId).join(",").slice(0, 200),
          summary:
            `Manuales x${quantity} evento ${data.eventId} · ${isCourtesy ? "cortesía" : "venta"} · ` +
            `${(data.buyerEmail || "").slice(0, 80)}`,
          at: admin.firestore.FieldValue.serverTimestamp(),
        });
      } catch (auditErr) {
        console.warn("[createManualTicket] audit_logs:", (auditErr as Error).message);
      }

      // 6. Generar QRs para todos los tickets
      console.log("[createManualTicket] Generando QRs...");
      const ticketsWithQR = await Promise.all(
        ticketsToCreate.map(async (ticket) => {
          const qrCodeImage = await QRCode.toDataURL(ticket.qrCodeData, {errorCorrectionLevel: "H", width: 250});
          return {
            ticket: {
              ticketId: ticket.ticketId,
              id: ticket.ticketId,
              eventName: ticket.eventName,
              eventDate: ticket.eventDate,
              eventTime: ticket.eventTime,
              eventVenue: ticket.eventVenue,
              city: ticket.city,
              buyerName: ticket.buyerName || "Comprador",
              buyerEmail: ticket.buyerEmail,
              price: ticket.price || 0,
              sectionName: ticket.sectionName || undefined,
            },
            qrCodeImage,
          };
        })
      );
      console.log("[createManualTicket] QRs generados:", ticketsWithQR.length);

      // 7. Generar UN PDF con todos los tickets
      let pdfBuffer: Buffer;
      try {
        console.log("[createManualTicket] Generando PDF...");
        pdfBuffer = await generateMultipleTicketsPdf(ticketsWithQR, eventData);
        console.log("[createManualTicket] PDF OK, size:", pdfBuffer?.length);
      } catch (error) {
        const e = error as Error;
        console.error("[createManualTicket] Error generando PDF:", e.message, e.stack);
        throw new functions.https.HttpsError("internal", "Error generando el PDF con los tickets.");
      }

      // 8. Enviar UN email con el PDF que contiene todos los QRs
      const rApiKey = resendApiKey.value();
      const sEmail = senderEmail.value();
      const sName = senderName.value() || "Ticket Colombia";

      if (!rApiKey || !sEmail) {
        throw new functions.https.HttpsError("failed-precondition", "Resend API key o Sender email no configurados.");
      }

      try {
        console.log("[createManualTicket] Enviando email a:", ticketsToCreate[0].buyerEmail);
        await sendTicketEmail(
          ticketsToCreate[0].buyerEmail, // Usar el email del primer ticket (todos tienen el mismo)
          `Tus ${ticketsToCreate.length} Ticket(s) para ${ticketsToCreate[0].eventName}`,
          ticketsToCreate[0].eventName,
          ticketsToCreate[0].buyerName,
          pdfBuffer,
          rApiKey,
          sEmail,
          sName
        );
        console.log("[createManualTicket] Email enviado OK");
      } catch (error) {
        const e = error as Error;
        console.error("[createManualTicket] Error enviando email:", e.message, e.stack);
        throw new functions.https.HttpsError("internal", `Error enviando el correo: ${e.message}`);
      }

      const emailResults = [{success: true, ticketsCount: ticketsToCreate.length}];

      console.log("[createManualTicket] Éxito total, tickets:", ticketsToCreate.length);
      return {
        success: true,
        message: `Se crearon ${ticketsToCreate.length} tickets y se enviaron los correos.`,
        ticketIds: ticketsToCreate.map((t) => t.ticketId),
        emailResults: emailResults,
      };
    } catch (error) {
      const e = error as Error;
      console.error("[createManualTicket] Error no capturado:", e.message, e.stack);
      if (error instanceof functions.https.HttpsError) throw error;
      throw new functions.https.HttpsError("internal", e.message);
    }
  });

