import {QRCodeGenerator} from "../types";

/**
 * Generador de códigos QR para tickets
 */
export class SimpleQRCodeGenerator implements QRCodeGenerator {
  /**
   * Genera un código QR para un ticket
   * @param {string} ticketId - ID del ticket
   * @param {string} appUrl - URL base de la aplicación
   * @return {Promise<string>} URL de validación del ticket
   */
  async generateQRCode(ticketId: string, appUrl: string): Promise<string> {
    try {
      // Parsear la URL para agregar el subdominio admin
      const url = new URL(appUrl);

      // Agregar el subdominio "admin" al hostname
      // Si el hostname es "ticketcolombia.com", se convierte en "admin.ticketcolombia.com"
      // Si ya tiene subdominio como "app.ticketcolombia.com", se convierte en "admin.ticketcolombia.com"
      const hostnameParts = url.hostname.split(".");

      // Si ya tiene un subdominio, reemplazarlo con "admin"
      // Si no tiene subdominio, agregarlo
      if (hostnameParts.length > 2) {
        hostnameParts[0] = "admin";
      } else {
        hostnameParts.unshift("admin");
      }

      const adminHostname = hostnameParts.join(".");

      // Construir la URL de validación con el subdominio admin
      const portPart = url.port ? ":" + url.port : "";
      const validationUrl = `${url.protocol}//${adminHostname}${portPart}/validate-ticket/${ticketId}`;

      console.log(`QR code generated for ticket ${ticketId}: ${validationUrl}`);

      // Por ahora retornamos la URL directamente
      // En el futuro se puede integrar con una librería de QR como 'qrcode'
      return validationUrl;
    } catch (error) {
      console.error(`Error generating QR code for ticket ${ticketId}:`, error);
      return "";
    }
  }
}
