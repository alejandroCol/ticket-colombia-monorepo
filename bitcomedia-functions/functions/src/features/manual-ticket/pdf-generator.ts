import PDFDocument from "pdfkit";

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
}

/**
 * Genera un PDF con los tickets y sus códigos QR
 * @param {TicketData} ticket - Datos del ticket
 * @param {any} eventData - Datos del evento
 * @param {string} qrCodeImage - Imagen del código QR en base64
 * @return {Promise<Buffer>} Buffer del PDF generado
 */
export async function generateTicketPdf(
  ticket: TicketData,
  eventData: any,
  qrCodeImage: string
): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({
        size: "A4",
        margins: {top: 50, bottom: 50, left: 50, right: 50},
      });

      const chunks: Buffer[] = [];

      doc.on("data", (chunk) => chunks.push(chunk));
      doc.on("end", () => resolve(Buffer.concat(chunks)));
      doc.on("error", reject);

      // --- HEADER ---
      doc
        .fontSize(28)
        .font("Helvetica-Bold")
        .fillColor("#00d4ff")
        .text("TICKET COLOMBIA", {align: "center"});

      doc.moveDown(0.5);

      // --- EVENT INFO ---
      doc
        .fontSize(22)
        .fillColor("#1a1a1a")
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
        .fillColor("#333333")
        .text(`📅 ${dateStr} - ⏰ ${ticket.eventTime}`, {align: "center"});

      doc.moveDown(0.2);

      doc
        .fontSize(12)
        .fillColor("#666666")
        .text(`📍 ${ticket.eventVenue}`, {align: "center"})
        .text(`${ticket.city}`, {align: "center"});

      doc.moveDown(1.5);

      // --- DIVIDER LINE ---
      doc
        .moveTo(50, doc.y)
        .lineTo(550, doc.y)
        .strokeColor("#cccccc")
        .lineWidth(2)
        .stroke();

      doc.moveDown(1);

      // --- BUYER INFO ---
      doc
        .fontSize(14)
        .fillColor("#1a1a1a")
        .text("Información del Comprador", {align: "left"});

      doc.moveDown(0.5);

      doc
        .fontSize(11)
        .fillColor("#333333")
        .text(`Nombre: ${ticket.buyerName}`)
        .text(`Email: ${ticket.buyerEmail}`);

      doc.moveDown(1.5);

      // --- QR CODE SECTION ---
      doc
        .fontSize(16)
        .fillColor("#00d4ff")
        .text("Tu Ticket:", {align: "left"});

      doc.moveDown(1);

      const yPosition = doc.y;

      // Box para el ticket
      doc
        .rect(40, yPosition - 10, 520, 200)
        .strokeColor("#00d4ff")
        .lineWidth(2)
        .stroke();

      // QR Code (convertir data URL a imagen)
      try {
        const base64Data = qrCodeImage.split(",")[1];
        const qrBuffer = Buffer.from(base64Data, "base64");

        doc.image(qrBuffer, 60, yPosition + 10, {
          width: 140,
          height: 140,
        });
      } catch (error) {
        console.error("Error adding QR to PDF:", error);
        doc
          .fontSize(10)
          .fillColor("#ff0000")
          .text("Error cargando QR", 60, yPosition + 70);
      }

      // Ticket Info al lado del QR
      const infoX = 220;
      const infoY = yPosition + 20;

      doc
        .fontSize(18)
        .fillColor("#00d4ff")
        .text("Ticket de Cortesía", infoX, infoY);

      const ticketId = ticket.ticketId || ticket.id || "N/A";
      const displayId = ticketId.length > 20 ? ticketId.substring(0, 20) + "..." : ticketId;

      doc
        .fontSize(10)
        .fillColor("#333333")
        .text(`ID: ${displayId}`, infoX, infoY + 30)
        .text(`Titular: ${ticket.buyerName}`, infoX, infoY + 50)
        .text(`Email: ${ticket.buyerEmail}`, infoX, infoY + 70);

      doc
        .fontSize(12)
        .fillColor("#00d4ff")
        .font("Helvetica-Bold")
        .text(`Valor: $${ticket.price.toLocaleString("es-CO")}`, infoX, infoY + 100);

      doc
        .fontSize(9)
        .fillColor("#999999")
        .font("Helvetica")
        .text("Presenta este QR en la entrada", infoX, infoY + 125, {width: 280});

      doc.moveDown(13);

      // --- FOOTER ---
      const footerY = doc.page.height - 80;

      doc
        .fontSize(9)
        .fillColor("#666666")
        .text(
          "Este ticket es válido para una sola entrada. Presenta el código QR en la entrada del evento.",
          50,
          footerY,
          {align: "center", width: 500}
        );

      doc.moveDown(0.5);

      doc
        .fontSize(8)
        .fillColor("#999999")
        .text(
          `Generado el ${new Date().toLocaleString("es-CO")} | Ticket Colombia`,
          {align: "center"}
        );

      doc.end();
    } catch (error) {
      console.error("Error generating PDF:", error);
      reject(error);
    }
  });
}

