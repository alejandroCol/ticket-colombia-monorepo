import PDFDocument from "pdfkit";
import * as https from "https";
import * as http from "http";
import {
  ticketFlyerAccentColorFromEvent,
  ticketFlyerMinimalEmailColorFromEvent,
  ticketFlyerMinimalNameColorFromEvent,
} from "./ticket-flyer-pdf-theme";

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
  buyerIdNumber?: string;
}

interface TicketWithQR {
  ticket: TicketData;
  qrCodeImage: string;
}

/** Diseño del flyer PDF (configurable en admin por evento). */
export type TicketFlyerPdfLayout = "standard" | "minimal_center";

type PdfKitDoc = InstanceType<typeof PDFDocument>;

function flyerLayoutFromEvent(eventData: any): TicketFlyerPdfLayout {
  const v = String(eventData?.ticket_flyer_pdf_layout ?? "standard")
    .toLowerCase()
    .trim();
  if (v === "minimal_center" || v === "opcion_2" || v === "2") {
    return "minimal_center";
  }
  return "standard";
}

/**
 * Opción 2 (OnePay / cualquier pasarela): sin titular del evento.
 * Recuadro a todo el ancho útil (márgenes laterales), centrado verticalmente:
 * QR a la izquierda, datos del comprador y localidad a la derecha.
 */
function drawMinimalCenterFlyerPage(
  doc: PdfKitDoc,
  ticket: TicketData,
  qrCodeImage: string,
  ticketIndex: number,
  totalTickets: number,
  localityColor: string,
  buyerNameColor: string,
  emailAndCaptionColor: string
): void {
  const pageW = doc.page.width;
  const pageH = doc.page.height;
  const marginX = 50;
  const boxW = pageW - 2 * marginX;
  const pad = 22;
  const gapQrText = 28;
  const qrSize = 188;

  const innerTextW = Math.max(
    120,
    boxW - 2 * pad - qrSize - gapQrText
  );
  const textX = marginX + pad + qrSize + gapQrText;

  const localityH = ticket.sectionName ? 22 : 0;
  const nameH = 20;
  const emailH = 18;
  const idDocH = ticket.buyerIdNumber ? 16 : 0;
  const hintH = 14;
  const multiH = totalTickets > 1 ? 14 : 0;
  const idGap = ticket.buyerIdNumber ? 10 : 0;
  const gaps =
    (ticket.sectionName ? 10 : 0) +
    10 +
    10 +
    idGap +
    10 +
    (totalTickets > 1 ? 6 : 0);
  const textColH =
    localityH + nameH + emailH + idDocH + hintH + multiH + gaps;
  const boxH = Math.max(qrSize + 2 * pad, textColH + 2 * pad);
  /** Desplazamiento respecto al centro: 10 % de la altura de página hacia arriba (antes 20 %; bajado 10 pp). */
  const verticalLift = pageH * 0.1;
  const boxTop = Math.max(36, (pageH - boxH) / 2 - verticalLift);

  doc
    .rect(marginX, boxTop, boxW, boxH)
    .strokeColor("#ffffff")
    .lineWidth(1.75)
    .stroke();

  const qrX = marginX + pad;
  const qrY = boxTop + pad;

  try {
    const base64Data = qrCodeImage.split(",")[1];
    const qrBuffer = Buffer.from(base64Data, "base64");
    doc.image(qrBuffer, qrX, qrY, {width: qrSize, height: qrSize});
  } catch (error) {
    console.error("Error adding QR to PDF (minimal layout):", error);
    doc
      .fontSize(10)
      .fillColor("#ff0000")
      .text("Error cargando QR", qrX, qrY + qrSize * 0.35, {
        width: qrSize,
        align: "center",
      });
  }

  let yText = boxTop + pad;
  if (ticket.sectionName) {
    doc
      .font("Helvetica-Bold")
      .fontSize(16)
      .fillColor(localityColor)
      .text(ticket.sectionName, textX, yText, {width: innerTextW, align: "left"});
    yText += localityH + 10;
  }

  doc
    .font("Helvetica")
    .fontSize(13)
    .fillColor(buyerNameColor)
    .text(ticket.buyerName, textX, yText, {width: innerTextW, align: "left"});
  yText += nameH + 10;

  doc
    .fontSize(11)
    .fillColor(emailAndCaptionColor)
    .text(ticket.buyerEmail, textX, yText, {width: innerTextW, align: "left"});
  yText += emailH + 10;

  if (ticket.buyerIdNumber) {
    doc
      .font("Helvetica")
      .fontSize(10)
      .fillColor(emailAndCaptionColor)
      .text(`Cédula / documento: ${ticket.buyerIdNumber}`, textX, yText, {
        width: innerTextW,
        align: "left",
      });
    yText += idDocH + 10;
  }

  doc
    .font("Helvetica")
    .fontSize(9)
    .fillColor(emailAndCaptionColor)
    .text("Presenta este QR en la entrada", textX, yText, {
      width: innerTextW,
      align: "left",
    });
  yText += hintH + 8;

  if (totalTickets > 1) {
    doc
      .fontSize(9)
      .fillColor(emailAndCaptionColor)
      .text(`Entrada ${ticketIndex + 1} de ${totalTickets}`, textX, yText, {
        width: innerTextW,
        align: "left",
      });
  }
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

        const layout = flyerLayoutFromEvent(eventData);
        const accentColor = ticketFlyerAccentColorFromEvent(eventData);
        const minimalNameColor = ticketFlyerMinimalNameColorFromEvent(eventData);
        const minimalEmailColor = ticketFlyerMinimalEmailColorFromEvent(eventData);
        console.log("[generateMultipleTicketsPdf] Diseño flyer:", layout, "accent:", accentColor);

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

          if (layout === "minimal_center") {
            drawMinimalCenterFlyerPage(
              doc,
              ticket,
              qrCodeImage,
              i,
              ticketsWithQR.length,
              accentColor,
              minimalNameColor,
              minimalEmailColor
            );
            continue;
          }

          // --- Estándar (opción 1): HEADER (texto blanco sobre imagen oscura) ---
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
              .fillColor(accentColor)
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
          if (ticket.buyerIdNumber) {
            doc.text(`Cédula / documento: ${ticket.buyerIdNumber}`);
          }

          doc.moveDown(1.5);

          // --- QR CODE SECTION ---
          doc
            .fontSize(16)
            .fillColor(accentColor)
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

          let infoRy = infoY;
          doc
            .fontSize(10)
            .fillColor("#e0e0e0")
            .text(`ID: ${displayId}`, infoX, infoRy);
          infoRy += 22;
          doc.text(`Titular: ${ticket.buyerName}`, infoX, infoRy);
          infoRy += 20;
          doc.text(`Email: ${ticket.buyerEmail}`, infoX, infoRy);
          infoRy += 20;
          if (ticket.buyerIdNumber) {
            doc.text(`Cédula / documento: ${ticket.buyerIdNumber}`, infoX, infoRy);
            infoRy += 22;
          }

          if (ticket.sectionName) {
            doc
              .fontSize(12)
              .fillColor(accentColor)
              .font("Helvetica-Bold")
              .text(`Localidad: ${ticket.sectionName}`, infoX, infoRy);
            infoRy += 22;
          }

          doc
            .fontSize(12)
            .fillColor(accentColor)
            .font("Helvetica-Bold")
            .text(
              ticket.price === 0 ? "Valor: Cortesía" : `Valor: $${ticket.price.toLocaleString("es-CO")}`,
              infoX,
              infoRy
            );
          infoRy += 24;

          doc
            .fontSize(9)
            .fillColor("#cccccc")
            .font("Helvetica")
            .text("Presenta este QR en la entrada", infoX, infoRy, {width: 280});

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

