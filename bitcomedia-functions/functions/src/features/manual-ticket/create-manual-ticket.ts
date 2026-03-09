import * as functions from "firebase-functions/v1";
import * as admin from "firebase-admin";
import {defineSecret} from "firebase-functions/params";
import {generateMultipleTicketsPdf} from "./pdf-generator-multiple";
import {sendTicketEmail} from "./email-sender";
import {randomUUID} from "crypto";
import QRCode from "qrcode";

// Definir secretos para el envío de correos
const resendApiKey = defineSecret("RESEND_API_KEY");
const senderEmail = defineSecret("SENDER_EMAIL");
const senderName = defineSecret("SENDER_NAME");
const adminUrlSecret = defineSecret("ADMIN_URL");

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
      const adminUserDoc = await admin.firestore().collection("users").doc(adminUid).get();
      if (!adminUserDoc.exists || adminUserDoc.data()?.role !== "ADMIN") {
        throw new functions.https.HttpsError(
          "permission-denied",
          "Solo los administradores pueden crear tickets manuales."
        );
      }
      console.log("[createManualTicket] Auth OK, admin:", context.auth.uid);

      // 2. Validación de Datos de Entrada
      const {eventId, buyerName, buyerEmail, buyerPhone, buyerIdNumber, quantity, sectionId, sectionName, isCourtesy} = data;

      if (!eventId || !buyerName || !buyerEmail || !quantity || quantity <= 0) {
        throw new functions.https.HttpsError(
          "invalid-argument",
          "Faltan campos requeridos: eventId, buyerName, buyerEmail, quantity."
        );
      }
      console.log("[createManualTicket] Validación OK");

      // 3. Obtener Información del Evento
      console.log("[createManualTicket] Leyendo evento:", eventId);
      const eventDoc = await admin.firestore().collection("events").doc(eventId).get();
      if (!eventDoc.exists) {
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

      const ticketsToCreate = [];
      for (let i = 0; i < quantity; i++) {
        const ticketId = randomUUID(); // Generar un ID único para cada ticket
        const adminUrl = adminUrlSecret.value().trim(); // Limpiar espacios y saltos de línea
        const qrCodeData = `${adminUrl}/validate-ticket/${ticketId}`; // URL para validar el ticket en el admin panel

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
          price: ticketPrice,
          currency: "COP",
          status: "approved",
          paymentMethod: "manual",
          sectionId: sectionId || null,
          sectionName: sectionName || null,
          ticketStatus: "paid",
          amount: ticketPrice,
          purchaseAmount: ticketPrice, // Para reportes de ingresos (cortesía = 0)
          isCourtesy: !!isCourtesy, // No suma en ingresos cuando es true
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
          `Tus ${quantity} Ticket(s) para ${ticketsToCreate[0].eventName}`,
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

      const emailResults = [{success: true, ticketsCount: quantity}];

      console.log("[createManualTicket] Éxito total, tickets:", quantity);
      return {
        success: true,
        message: `Se crearon ${quantity} tickets y se enviaron los correos.`,
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

