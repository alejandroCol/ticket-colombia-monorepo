import {Resend} from "resend";

/**
 * Envía un email con el PDF del ticket usando Resend
 * @param {string} to - Email del destinatario
 * @param {string} subject - Asunto del email
 * @param {string} eventName - Nombre del evento
 * @param {string} buyerName - Nombre del comprador
 * @param {Buffer} pdfBuffer - Buffer del PDF a adjuntar
 * @param {string} resendApiKey - API Key de Resend
 * @param {string} senderEmail - Email del remitente
 * @param {string} senderName - Nombre del remitente
 * @return {Promise<void>} Promesa que se resuelve cuando el email se envía
 */
export async function sendTicketEmail(
  to: string,
  subject: string,
  eventName: string,
  buyerName: string,
  pdfBuffer: Buffer,
  resendApiKey: string,
  senderEmail: string,
  senderName = "Ticket Colombia"
): Promise<void> {
  const resend = new Resend(resendApiKey);

  try {
    const {data, error} = await resend.emails.send({
      from: `${senderName} <${senderEmail}>`,
      to: [to],
      subject: subject,
      html: generateEmailHTML(buyerName, eventName),
      attachments: [
        {
          filename: `ticket_${sanitizeFilename(eventName)}.pdf`,
          content: pdfBuffer,
        },
      ],
    });

    if (error) {
      console.error(`❌ Error sending email to ${to} for event ${eventName}:`, error);
      throw new Error(`Failed to send email: ${error.message}`);
    }

    console.log(`✅ Email sent successfully to ${to} for event ${eventName}. Email ID: ${data?.id}`);
  } catch (error) {
    console.error(`❌ Error sending email to ${to} for event ${eventName}:`, error);
    throw new Error(`Failed to send email: ${(error as Error).message}`);
  }
}

/**
 * Genera el HTML del email
 * @param {string} buyerName - Nombre del comprador
 * @param {string} eventName - Nombre del evento
 * @return {string} HTML del email
 */
function generateEmailHTML(buyerName: string, eventName: string): string {
  return `
    <!DOCTYPE html>
    <html lang="es">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Tu Ticket - ${eventName}</title>
    </head>
    <body style="margin: 0; padding: 0; font-family: Arial, sans-serif; background-color: #f4f4f4;">
      <table role="presentation" style="width: 100%; border-collapse: collapse;">
        <tr>
          <td style="padding: 20px 0; text-align: center;">
            <table role="presentation" style="max-width: 600px; margin: 0 auto; background-color: #0d1b2a; border-radius: 10px; overflow: hidden; box-shadow: 0 4px 6px rgba(0,0,0,0.1);">
              
              <!-- Header -->
              <tr>
                <td style="padding: 40px 20px; text-align: center; background: linear-gradient(135deg, #1b263b 0%, #0d1b2a 100%);">
                  <h1 style="color: #00d4ff; margin: 0; font-size: 32px; text-shadow: 0 2px 4px rgba(0,0,0,0.3);">
                    🎫 Ticket Colombia
                  </h1>
                </td>
              </tr>
              
              <!-- Main Content -->
              <tr>
                <td style="padding: 40px 30px; background-color: #1b263b;">
                  <h2 style="color: #00d4ff; margin: 0 0 20px 0; font-size: 24px;">
                    ¡Hola ${buyerName}!
                  </h2>
                  
                  <p style="color: #e0e1dd; font-size: 16px; line-height: 1.6; margin: 0 0 20px 0;">
                    Tu ticket ha sido generado exitosamente para el evento:
                  </p>
                  
                  <!-- Event Details Box -->
                  <table role="presentation" style="width: 100%; background-color: #0d1b2a; border-left: 4px solid #00d4ff; margin: 20px 0; border-radius: 5px;">
                    <tr>
                      <td style="padding: 25px;">
                        <h3 style="color: #00d4ff; margin: 0 0 15px 0; font-size: 20px;">
                          ${eventName}
                        </h3>
                      </td>
                    </tr>
                  </table>
                  
                  <!-- Instructions -->
                  <table role="presentation" style="width: 100%; background-color: rgba(0, 212, 255, 0.1); border-radius: 5px; margin: 20px 0;">
                    <tr>
                      <td style="padding: 20px;">
                        <p style="color: #00d4ff; margin: 0 0 10px 0; font-size: 16px; font-weight: bold;">
                          📱 Instrucciones Importantes:
                        </p>
                        
                        <ul style="color: #e0e1dd; font-size: 14px; line-height: 1.6; margin: 0; padding-left: 20px;">
                          <li style="margin-bottom: 8px;">
                            Descarga el PDF adjunto a este correo
                          </li>
                          <li style="margin-bottom: 8px;">
                            Presenta el código QR en la entrada del evento
                          </li>
                          <li style="margin-bottom: 8px;">
                            Este ticket es válido para una sola entrada
                          </li>
                          <li style="margin-bottom: 8px;">
                            Conserva este correo como comprobante
                          </li>
                        </ul>
                      </td>
                    </tr>
                  </table>
                  
                  <p style="color: #778da9; font-size: 14px; line-height: 1.6; margin: 30px 0 0 0; text-align: center;">
                    ℹ️ Si tienes alguna duda, no dudes en contactarnos
                  </p>
                </td>
              </tr>
              
              <!-- Footer -->
              <tr>
                <td style="padding: 30px 20px; text-align: center; background-color: #0d1b2a; border-top: 1px solid rgba(119, 141, 169, 0.2);">
                  <p style="color: #778da9; font-size: 13px; margin: 0 0 10px 0;">
                    ¡Gracias por confiar en Ticket Colombia!
                  </p>
                  
                  <p style="color: #778da9; font-size: 12px; margin: 0;">
                    Ticket Colombia © ${new Date().getFullYear()} | Todos los derechos reservados
                  </p>
                  
                  <p style="color: #778da9; font-size: 11px; margin: 10px 0 0 0;">
                    Este es un correo automático, por favor no responder.
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
 * Sanitiza el nombre del archivo
 * @param {string} filename - Nombre del archivo a sanitizar
 * @return {string} Nombre del archivo sanitizado
 */
function sanitizeFilename(filename: string): string {
  return filename
    .replace(/[^a-zA-Z0-9\s]/g, "") // Remover caracteres especiales
    .replace(/\s+/g, "_") // Reemplazar espacios con guiones bajos
    .substring(0, 50); // Limitar longitud
}

