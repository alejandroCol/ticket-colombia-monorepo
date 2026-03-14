import * as functions from "firebase-functions/v1";
import * as admin from "firebase-admin";
import {defineSecret} from "firebase-functions/params";
import {generateMultipleTicketsPdf} from "../manual-ticket/pdf-generator-multiple";
import {sendTicketEmail} from "../manual-ticket/email-sender";
import {randomUUID} from "crypto";
import QRCode from "qrcode";

const resendApiKey = defineSecret("RESEND_API_KEY");
const senderEmail = defineSecret("SENDER_EMAIL");
const senderName = defineSecret("SENDER_NAME");
const adminUrlSecret = defineSecret("ADMIN_URL");

interface TransferTicketRequest {
  ticketId: string;
  recipientEmail: string;
  recipientName?: string;
}

/**
 * Transfiere un ticket a otra persona.
 * Anula el ticket actual y crea uno nuevo para el destinatario.
 * El destinatario recibe un correo con la nueva boleta.
 */
export const transferTicket = functions
  .runWith({
    secrets: [resendApiKey, senderEmail, senderName, adminUrlSecret],
    timeoutSeconds: 60,
    memory: "1GB",
  })
  .https.onCall(async (data: TransferTicketRequest, context) => {
    try {
      if (!context.auth) {
        throw new functions.https.HttpsError(
          "unauthenticated",
          "Debes iniciar sesión para transferir un ticket."
        );
      }

      const {ticketId, recipientEmail, recipientName} = data;
      if (!ticketId || !recipientEmail) {
        throw new functions.https.HttpsError(
          "invalid-argument",
          "Se requieren ticketId y recipientEmail."
        );
      }

      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(recipientEmail)) {
        throw new functions.https.HttpsError(
          "invalid-argument",
          "El email del destinatario no es válido."
        );
      }

      const db = admin.firestore();
      const ticketRef = db.collection("tickets").doc(ticketId);
      const ticketSnap = await ticketRef.get();

      if (!ticketSnap.exists) {
        throw new functions.https.HttpsError("not-found", "Ticket no encontrado.");
      }

      const ticketData = ticketSnap.data() as Record<string, unknown>;
      const ownerUserId = ticketData.userId as string | undefined;
      const buyerEmail = ticketData.buyerEmail as string | undefined;
      const authEmail = context.auth.token?.email as string | undefined;

      const isOwner = ownerUserId
        ? ownerUserId === context.auth.uid
        : (buyerEmail && authEmail && buyerEmail.toLowerCase() === authEmail.toLowerCase());

      if (!isOwner) {
        throw new functions.https.HttpsError(
          "permission-denied",
          "No tienes permiso para transferir este ticket."
        );
      }

      if (
        ticketData.ticketStatus === "cancelled" ||
        ticketData.ticketStatus === "disabled" ||
        ticketData.transferredTo
      ) {
        throw new functions.https.HttpsError(
          "failed-precondition",
          "Este ticket ya no puede ser transferido (cancelado, transferido o usado)."
        );
      }

      const eventId = ticketData.eventId as string;
      const eventDoc = await db.collection("events").doc(eventId).get();
      if (!eventDoc.exists) {
        throw new functions.https.HttpsError("not-found", "Evento no encontrado.");
      }
      const eventData = eventDoc.data() as Record<string, unknown>;

      const newTicketId = randomUUID();
      const adminUrl = adminUrlSecret.value().trim();
      const qrCodeUrl = `${adminUrl}/validate-ticket/${newTicketId}`;

      const eventName = (ticketData.metadata as {eventName?: string})?.eventName ||
        (eventData.name as string) ||
        "Evento";
      const seatNumber = (ticketData.metadata as {seatNumber?: string})?.seatNumber ||
        ticketData.seatNumber ||
        "General";
      const quantity = (ticketData.quantity as number) || 1;
      const amount = (ticketData.amount as number) || 0;

      const newTicketDoc: Record<string, unknown> = {
        id: newTicketId,
        ticketId: newTicketId,
        eventId,
        userId: "", // Recipient may not have account
        buyerEmail: recipientEmail,
        buyerName: recipientName || "Destinatario",
        metadata: {
          eventName,
          seatNumber,
          userName: recipientName || recipientEmail,
        },
        quantity,
        amount,
        currency: ticketData.currency || "COP",
        ticketStatus: "paid",
        paymentStatus: "approved",
        paymentMethod: ticketData.paymentMethod || "transfer",
        paymentId: `transfer_${ticketId}`,
        preferenceId: `transfer_${ticketId}`,
        qrCode: qrCodeUrl,
        qrCodeData: qrCodeUrl,
        sectionId: ticketData.sectionId || null,
        sectionName: ticketData.sectionName || null,
        transferredFrom: ticketId,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      };

      await db.collection("tickets").doc(newTicketId).set(newTicketDoc);

      await ticketRef.update({
        ticketStatus: "disabled",
        transferredTo: newTicketId,
        transferredAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      });

      const qrCodeImage = await QRCode.toDataURL(qrCodeUrl, {
        errorCorrectionLevel: "H",
        width: 250,
      });

      const eventDate = String(eventData.date ?? "");
      const eventTime = String(eventData.time ?? "");

      const ticketsWithQR = [
        {
          ticket: {
            ticketId: newTicketId,
            id: newTicketId,
            eventName,
            eventDate,
            eventTime,
            eventVenue: (eventData.venue as {name?: string})?.name || "",
            city: (eventData.city as string) || "",
            buyerName: recipientName || "Destinatario",
            buyerEmail: recipientEmail,
            price: amount,
            sectionName: (ticketData.sectionName as string) || undefined,
          },
          qrCodeImage,
        },
      ];

      const pdfBuffer = await generateMultipleTicketsPdf(ticketsWithQR, eventData);

      const rApiKey = resendApiKey.value();
      const sEmail = senderEmail.value();
      const sName = senderName.value() || "Ticket Colombia";

      if (rApiKey && sEmail) {
        await sendTicketEmail(
          recipientEmail,
          `Tu ticket transferido: ${eventName}`,
          eventName,
          recipientName || "Destinatario",
          pdfBuffer,
          rApiKey,
          sEmail,
          sName
        );
      }

      return {
        success: true,
        message: "Ticket transferido exitosamente. El destinatario recibirá un correo con la nueva boleta.",
        newTicketId,
      };
    } catch (error) {
      if (error instanceof functions.https.HttpsError) throw error;
      const e = error as Error;
      console.error("[transferTicket] Error:", e.message, e.stack);
      throw new functions.https.HttpsError("internal", e.message);
    }
  });
