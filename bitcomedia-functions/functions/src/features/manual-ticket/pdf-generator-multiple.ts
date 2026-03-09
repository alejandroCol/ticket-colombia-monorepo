import PDFDocument from "pdfkit";
import * as https from "https";
import * as http from "http";

interface TicketData {
  ticketId?: string;
  id?: string;
  eventName: string;
  eventDate: any;
  eventTime: string;
  eventVenue: string;
  city: string;
  buyerName: string;
  buyerEmail: string;
  price: number;
  sectionName?: string;
}

interface TicketWithQR {
  ticket: TicketData;
  qrCodeImage: string;
}

/**
 * Descarga una imagen desde una URL (soporta http y https)
 * @param {string} url - URL de la imagen a descargar
 * @return {Promise<Buffer>} Buffer de la imagen descargada
 */
function downloadImage(url: string): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    try {
      const protocol = url.startsWith("https") ? https : http;
      const request = protocol.get(url, (response) => {
        if (response.statusCode && response.statusCode >= 300 &&
            response.statusCode < 400 && response.headers.location) {
          // Seguir redirecciones
          downloadImage(response.headers.location).then(resolve).catch(reject);
          return;
        }
        if (!response.statusCode || response.statusCode !== 200) {
          reject(new Error(`Failed to download image: ${response.statusCode || "unknown"}`));
          return;
        }
        const chunks: Buffer[] = [];
        response.on("data", (chunk) => chunks.push(chunk));
        response.on("end", () => resolve(Buffer.concat(chunks)));
        response.on("error", reject);
      });
      request.on("error", reject);
      request.setTimeout(10000, () => {
        request.destroy();
        reject(new Error("Image download timeout"));
      });
    } catch (error) {
      reject(error);
    }
  });
}

/**
 * Genera un PDF con múltiples tickets y sus códigos QR
 * @param {TicketWithQR[]} ticketsWithQR - Array de tickets con sus QRs
 * @param {any} eventData - Datos del evento
 * @return {Promise<Buffer>} Buffer del PDF generado
 */
export async function generateMultipleTicketsPdf(
  ticketsWithQR: TicketWithQR[],
  eventData: any
): Promise<Buffer> {
  console.log("[generateMultipleTicketsPdf] Inicio, páginas:", ticketsWithQR.length);
  return new Promise((resolve, reject) => {
    const generatePdf = async () => {
      try {
        const doc = new PDFDocument({
          size: "A4",
          margins: {top: 50, bottom: 50, left: 50, right: 50},
        });

        const chunks: Buffer[] = [];

        doc.on("data", (chunk) => chunks.push(chunk));
        doc.on("end", () => resolve(Buffer.concat(chunks)));
        doc.on("error", reject);

        // Imagen de fondo: prioridad ticket_background_image_url (imagen boleto), fallback cover_image_url
        const backgroundImageUrl = eventData.ticket_background_image_url || eventData.cover_image_url;
        let backgroundImage: Buffer | null = null;
        if (backgroundImageUrl && typeof backgroundImageUrl === "string") {
          console.log("[generateMultipleTicketsPdf] Descargando imagen fondo...");
          try {
            backgroundImage = await Promise.race([
              downloadImage(backgroundImageUrl),
              new Promise<Buffer>((_, rejectTimeout) =>
                setTimeout(() => rejectTimeout(new Error("Timeout")), 5000)
              ),
            ]) as Buffer;
          } catch (error) {
            console.warn("[generateMultipleTicketsPdf] Imagen fondo falló:", (error as Error).message);
            backgroundImage = null;
          }
        }

        console.log("[generateMultipleTicketsPdf] Generando páginas...");
        // Generar cada ticket en el PDF
        for (let i = 0; i < ticketsWithQR.length; i++) {
          const {ticket, qrCodeImage} = ticketsWithQR[i];

          // Si no es el primer ticket, agregar nueva página
          if (i > 0) {
            doc.addPage();
          }

          // --- FONDO: imagen boleto (sin overlay, texto blanco encima)
          if (backgroundImage) {
            try {
              doc.image(backgroundImage, 0, 0, {
                width: doc.page.width,
                height: doc.page.height,
              });
            } catch (error) {
              console.warn("Error adding background image:", error);
            }
          }

          // --- HEADER (texto blanco sobre imagen oscura) ---
          doc
            .fontSize(28)
            .font("Helvetica-Bold")
            .fillColor("#ffffff")
            .fillOpacity(1)
            .text("TICKET COLOMBIA", {align: "center"});

          doc.moveDown(0.5);

          // --- EVENT INFO ---
          doc
            .fontSize(22)
            .fillColor("#ffffff")
            .text(ticket.eventName, {align: "center"});

          doc.moveDown(0.5);

          // Fecha y hora
          let dateStr = "Fecha por confirmar";
          if (ticket.eventDate) {
            try {
              const date = ticket.eventDate.toDate ? ticket.eventDate.toDate() : new Date(ticket.eventDate);
              dateStr = date.toLocaleDateString("es-CO", {
                year: "numeric",
                month: "long",
                day: "numeric",
              });
            } catch (e) {
              console.error("Error parsing date:", e);
            }
          }

          doc
            .fontSize(14)
            .fillColor("#e0e0e0")
            .text(`${dateStr} - ${ticket.eventTime}`, {align: "center"});

          doc.moveDown(0.2);

          doc
            .fontSize(12)
            .fillColor("#cccccc")
            .text(`${ticket.eventVenue}`, {align: "center"})
            .text(`${ticket.city}`, {align: "center"});

          // Mostrar localidad si existe
          if (ticket.sectionName) {
            doc.moveDown(0.3);
            doc
              .fontSize(16)
              .fillColor("#00d4ff")
              .font("Helvetica-Bold")
              .text(`${ticket.sectionName}`, {align: "center"});
          }

          doc.moveDown(1.5);

          // --- DIVIDER LINE ---
          doc
            .moveTo(50, doc.y)
            .lineTo(550, doc.y)
            .strokeColor("#ffffff")
            .lineWidth(1.5)
            .stroke();

          doc.moveDown(1);

          // --- BUYER INFO ---
          doc
            .fontSize(14)
            .fillColor("#ffffff")
            .text("Información del Comprador", {align: "left"});

          doc.moveDown(0.5);

          doc
            .fontSize(11)
            .fillColor("#e0e0e0")
            .text(`Nombre: ${ticket.buyerName}`)
            .text(`Email: ${ticket.buyerEmail}`);

          doc.moveDown(1.5);

          // --- QR CODE SECTION ---
          doc
            .fontSize(16)
            .fillColor("#00d4ff")
            .text(`Ticket ${i + 1} de ${ticketsWithQR.length}:`, {align: "left"});

          doc.moveDown(1);

          const yPosition = doc.y;

          // Box para el ticket (borde blanco para contraste)
          doc
            .rect(40, yPosition - 10, 520, 230)
            .strokeColor("#ffffff")
            .lineWidth(2)
            .stroke();

          // QR Code (convertir data URL a imagen)
          try {
            const base64Data = qrCodeImage.split(",")[1];
            const qrBuffer = Buffer.from(base64Data, "base64");

            doc.image(qrBuffer, 60, yPosition + 10, {
              width: 200,
              height: 200,
            });
          } catch (error) {
            console.error("Error adding QR to PDF:", error);
            doc
              .fontSize(10)
              .fillColor("#ff0000")
              .text("Error cargando QR", 60, yPosition + 70);
          }

          // Ticket Info al lado del QR (texto blanco sobre imagen)
          const infoX = 280;
          const infoY = yPosition + 20;

          const ticketId = ticket.ticketId || ticket.id || "N/A";
          const displayId = ticketId.length > 20 ? ticketId.substring(0, 20) + "..." : ticketId;

          doc
            .fontSize(10)
            .fillColor("#e0e0e0")
            .text(`ID: ${displayId}`, infoX, infoY)
            .text(`Titular: ${ticket.buyerName}`, infoX, infoY + 25)
            .text(`Email: ${ticket.buyerEmail}`, infoX, infoY + 45);

          if (ticket.sectionName) {
            doc
              .fontSize(12)
              .fillColor("#00d4ff")
              .font("Helvetica-Bold")
              .text(`Localidad: ${ticket.sectionName}`, infoX, infoY + 70);
          }

          doc
            .fontSize(12)
            .fillColor("#00d4ff")
            .font("Helvetica-Bold")
            .text(
              ticket.price === 0 ? "Valor: Cortesía" : `Valor: $${ticket.price.toLocaleString("es-CO")}`,
              infoX,
              infoY + (ticket.sectionName ? 95 : 70)
            );

          doc
            .fontSize(9)
            .fillColor("#cccccc")
            .font("Helvetica")
            .text("Presenta este QR en la entrada", infoX, infoY + (ticket.sectionName ? 120 : 95), {width: 280});

          // Si hay más tickets, agregar espacio antes del siguiente
          if (i < ticketsWithQR.length - 1) {
            doc.moveDown(13);
          }
        }

        // --- FOOTER (texto claro sobre imagen) ---
        const footerY = doc.page.height - 80;

        const footerText = `Este documento contiene ${ticketsWithQR.length} ticket(s). ` +
        "Cada ticket es válido para una sola entrada. " +
        "Presenta el código QR correspondiente en la entrada del evento.";
        doc
          .fontSize(9)
          .fillColor("#e0e0e0")
          .text(
            footerText,
            50,
            footerY,
            {align: "center", width: 500}
          );

        doc.moveDown(0.5);

        doc
          .fontSize(8)
          .fillColor("#aaaaaa")
          .text(
            `Generado el ${new Date().toLocaleString("es-CO")} | Ticket Colombia`,
            {align: "center"}
          );

        doc.end();
        console.log("[generateMultipleTicketsPdf] PDF listo");
      } catch (error) {
        console.error("[generateMultipleTicketsPdf] Error:", (error as Error).message, (error as Error).stack);
        reject(error);
      }
    };

    generatePdf().catch((error) => {
      console.error("Error generating PDF:", error);
      reject(error);
    });
  });
}

