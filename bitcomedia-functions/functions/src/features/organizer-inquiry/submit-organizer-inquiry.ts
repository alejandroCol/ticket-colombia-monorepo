import * as functions from "firebase-functions/v1";
import {defineSecret} from "firebase-functions/params";
import type {OrganizerInquiryPayload} from "./types";
import {validateOrganizerInquiry} from "./validate-organizer-inquiry";
import {sendOrganizerInquiryEmail} from "./send-organizer-inquiry-email";

const resendApiKey = defineSecret("RESEND_API_KEY");
const senderEmail = defineSecret("SENDER_EMAIL");
const senderName = defineSecret("SENDER_NAME");

/**
 * Recibe solicitudes de organizadores desde la app pública y envía notificación por correo.
 */
export const submitOrganizerInquiry = functions
  .runWith({
    secrets: [resendApiKey, senderEmail, senderName],
    timeoutSeconds: 30,
  })
  .https.onCall(async (data: OrganizerInquiryPayload) => {
    const inquiry = validateOrganizerInquiry(data);

    const apiKey = resendApiKey.value();
    const fromEmail = senderEmail.value();
    const fromName = senderName.value() || "Ticket Colombia";

    if (!apiKey?.trim() || !fromEmail?.trim()) {
      throw new functions.https.HttpsError(
        "failed-precondition",
        "El envío de correos no está configurado. Intenta más tarde."
      );
    }

    try {
      await sendOrganizerInquiryEmail(inquiry, apiKey, fromEmail, fromName);
      return {success: true};
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.error("[submitOrganizerInquiry]", message);
      throw new functions.https.HttpsError(
        "internal",
        "No pudimos enviar tu solicitud. Intenta de nuevo en unos minutos."
      );
    }
  });
