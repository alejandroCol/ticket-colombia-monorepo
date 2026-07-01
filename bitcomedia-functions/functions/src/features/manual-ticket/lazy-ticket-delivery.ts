/** Carga diferida de PDF / QR / correo para no bloquear el arranque de Cloud Functions. */

type TicketDeliveryModules = {
  generateMultipleTicketsPdf: typeof import("./pdf-generator-multiple.js").generateMultipleTicketsPdf;
  buildPurchaseTicketsPdfPayload: typeof import("./purchase-ticket-pdf-builder.js").buildPurchaseTicketsPdfPayload;
  sendTicketEmail: typeof import("./email-sender.js").sendTicketEmail;
};

let ticketDeliveryPromise: Promise<TicketDeliveryModules> | null = null;

export function loadTicketDeliveryModules(): Promise<TicketDeliveryModules> {
  if (!ticketDeliveryPromise) {
    ticketDeliveryPromise = Promise.all([
      import("./pdf-generator-multiple.js"),
      import("./purchase-ticket-pdf-builder.js"),
      import("./email-sender.js"),
    ]).then(([pdfMod, builderMod, emailMod]) => ({
      generateMultipleTicketsPdf: pdfMod.generateMultipleTicketsPdf,
      buildPurchaseTicketsPdfPayload: builderMod.buildPurchaseTicketsPdfPayload,
      sendTicketEmail: emailMod.sendTicketEmail,
    }));
  }
  return ticketDeliveryPromise;
}

type QRCodeModule = typeof import("qrcode");

let qrcodePromise: Promise<QRCodeModule> | null = null;

export function loadQRCodeModule(): Promise<QRCodeModule> {
  if (!qrcodePromise) {
    qrcodePromise = import("qrcode");
  }
  return qrcodePromise;
}
