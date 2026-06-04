import {Resend} from "resend";
import type {ValidatedOrganizerInquiry} from "./types";

const ORGANIZER_INQUIRY_RECIPIENT = "ale.mar.guz@gmail.com";

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function buildInquiryEmailHtml(inquiry: ValidatedOrganizerInquiry): string {
  const rows = [
    ["Nombre", inquiry.name],
    ["Correo", inquiry.email],
    ["WhatsApp", inquiry.whatsappE164],
    ["Ciudad / código de área", inquiry.eventAreaLabel],
    ["Asistentes aprox.", inquiry.approximateAttendeesLabel],
  ];

  const tableRows = rows
    .map(
      ([label, value]) => `
        <tr>
          <td style="padding:12px 16px;color:#778da9;font-size:14px;width:38%;vertical-align:top;">
            ${escapeHtml(label)}
          </td>
          <td style="padding:12px 16px;color:#e0e1dd;font-size:15px;font-weight:600;">
            ${escapeHtml(value)}
          </td>
        </tr>`
    )
    .join("");

  return `
    <!DOCTYPE html>
    <html lang="es">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Nueva solicitud organizador</title>
    </head>
    <body style="margin:0;padding:0;font-family:Arial,sans-serif;background:#f4f4f4;">
      <table role="presentation" style="width:100%;border-collapse:collapse;">
        <tr>
          <td style="padding:24px 12px;text-align:center;">
            <table role="presentation" style="max-width:600px;margin:0 auto;background:#0d1b2a;border-radius:12px;overflow:hidden;">
              <tr>
                <td style="padding:32px 24px;text-align:center;background:linear-gradient(135deg,#1b263b,#0d1b2a);">
                  <h1 style="color:#00d4ff;margin:0;font-size:26px;">Nueva solicitud de organizador</h1>
                  <p style="color:#778da9;margin:12px 0 0;font-size:14px;">
                    Formulario · Ticket Colombia
                  </p>
                </td>
              </tr>
              <tr>
                <td style="padding:8px 0 24px;background:#1b263b;">
                  <table role="presentation" style="width:100%;border-collapse:collapse;">
                    ${tableRows}
                  </table>
                </td>
              </tr>
              <tr>
                <td style="padding:20px 24px;text-align:center;background:#0d1b2a;border-top:1px solid rgba(119,141,169,0.2);">
                  <p style="color:#778da9;font-size:12px;margin:0;">
                    Enviado desde ticketcolombia.co · ${new Date().toLocaleString("es-CO", {timeZone: "America/Bogota"})}
                  </p>
                </td>
              </tr>
            </table>
          </td>
        </tr>
      </table>
    </body>
    </html>
  `;
}

/**
 * Notifica al equipo de Ticket Colombia sobre una solicitud de organizador.
 */
export async function sendOrganizerInquiryEmail(
  inquiry: ValidatedOrganizerInquiry,
  resendApiKey: string,
  senderEmail: string,
  senderName: string
): Promise<void> {
  const resend = new Resend(resendApiKey);
  const subject = `Organizador: ${inquiry.name} · ${inquiry.eventAreaLabel.split("·")[0]?.trim() || inquiry.eventAreaCode}`;

  const {error} = await resend.emails.send({
    from: `${senderName} <${senderEmail}>`,
    to: [ORGANIZER_INQUIRY_RECIPIENT],
    replyTo: inquiry.email,
    subject,
    html: buildInquiryEmailHtml(inquiry),
  });

  if (error) {
    throw new Error(`Resend: ${error.message}`);
  }
}
