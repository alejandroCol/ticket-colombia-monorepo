import * as admin from "firebase-admin";
import QRCode from "qrcode";

export type TicketWithQRRow = {
  ticket: {
    ticketId: string;
    id: string;
    eventName: string;
    eventDate: unknown;
    eventTime: string;
    eventVenue: string;
    city: string;
    buyerName: string;
    buyerEmail: string;
    price: number;
    sectionName?: string;
    buyerIdNumber?: string;
  };
  qrCodeImage: string;
};

export type PurchasePdfBuildResult = {
  ticketsWithQR: TicketWithQRRow[];
  buyerEmail: string;
  buyerName: string;
  eventName: string;
  eventData: Record<string, unknown>;
};

function ticketLineAmountCOP(doc: Record<string, unknown>): number {
  const a = doc.amount;
  const p = doc.price;
  if (typeof a === "number" && Number.isFinite(a)) return Math.round(a);
  if (typeof p === "number" && Number.isFinite(p)) return Math.round(p);
  return 0;
}

/**
 * Construye las filas del PDF de compra (mismos QRs que en el correo automático).
 * - Con bundle: solo hijos con QR (nunca el padre; nunca duplicados).
 * - Sin bundle: una fila con el QR del documento padre.
 */
export async function buildPurchaseTicketsPdfPayload(
  parentTicketId: string,
  db: admin.firestore.Firestore
): Promise<PurchasePdfBuildResult | null> {
  const parentRef = db.collection("tickets").doc(parentTicketId);
  const parentSnap = await parentRef.get();
  if (!parentSnap.exists) return null;

  const parent = parentSnap.data() as Record<string, unknown>;
  const buyerEmail = String(parent.buyerEmail || "").trim();
  if (!buyerEmail) return null;

  const eventId = String(parent.eventId || "");
  let eventDoc = await db.collection("events").doc(eventId).get();
  if (!eventDoc.exists) {
    eventDoc = await db.collection("recurring_events").doc(eventId).get();
  }
  if (!eventDoc.exists) return null;

  const eventData = eventDoc.data() as Record<string, unknown>;
  const meta = parent.metadata as
    | {eventName?: string; userName?: string; buyerIdNumber?: string}
    | undefined;
  const eventName =
    String(meta?.eventName || "").trim() ||
    String(eventData.title || eventData.name || "Evento");
  const buyerName = String(meta?.userName || "").trim() || buyerEmail;

  const eventDate = eventData.date ?? "";
  const eventTime = String(eventData.time ?? "");
  const venueName = String((eventData.venue as {name?: string})?.name || "");
  const city = String(eventData.city || "");
  const parentAmount = ticketLineAmountCOP(parent);

  const ticketsWithQR: TicketWithQRRow[] = [];

  const rawChildIds = parent.childTicketIds as string[] | undefined;
  const childIds =
    Array.isArray(rawChildIds) ?
      [...new Set(rawChildIds.map((id) => String(id).trim()).filter(Boolean))] :
      [];

  if (childIds.length > 0) {
    const perPass = Math.max(0, Math.round(parentAmount / childIds.length));
    const seenQr = new Set<string>();

    for (const cid of childIds) {
      const cs = await db.collection("tickets").doc(cid).get();
      const cd = cs.data() as Record<string, unknown> | undefined;
      if (!cd) continue;

      const tKind = String(cd.ticketKind || "");
      if (tKind === "purchase_bundle_parent") continue;

      const qrUrl = String(cd.qrCode || "").trim();
      if (!qrUrl || seenQr.has(qrUrl)) continue;
      seenQr.add(qrUrl);

      const qrCodeImage = await QRCode.toDataURL(qrUrl, {
        errorCorrectionLevel: "M",
        width: 200,
      });
      const childMeta = cd.metadata as
        | {seatNumber?: string; buyerIdNumber?: string}
        | undefined;
      const localityLine = String(
        childMeta?.seatNumber ||
          cd.sectionName ||
          parent.sectionName ||
          ""
      ).trim();
      const buyerIdDoc = String(
        childMeta?.buyerIdNumber ?? meta?.buyerIdNumber ?? ""
      ).trim();
      const emailForRow = String(cd.buyerEmail || buyerEmail).trim() || buyerEmail;
      ticketsWithQR.push({
        ticket: {
          ticketId: cid,
          id: cid,
          eventName,
          eventDate,
          eventTime,
          eventVenue: venueName,
          city,
          buyerName,
          buyerEmail: emailForRow,
          price: perPass,
          sectionName: localityLine,
          ...(buyerIdDoc ? {buyerIdNumber: buyerIdDoc} : {}),
        },
        qrCodeImage,
      });
    }
  } else {
    const qrUrl = String(parent.qrCode || "").trim();
    if (!qrUrl) return null;
    const qrCodeImage = await QRCode.toDataURL(qrUrl, {
      errorCorrectionLevel: "M",
      width: 200,
    });
    const parentMeta = parent.metadata as
      | {seatNumber?: string; buyerIdNumber?: string}
      | undefined;
    const parentLocalityLine = String(
      parentMeta?.seatNumber || parent.sectionName || ""
    ).trim();
    const parentBuyerId = String(parentMeta?.buyerIdNumber ?? "").trim();
    ticketsWithQR.push({
      ticket: {
        ticketId: parentTicketId,
        id: parentTicketId,
        eventName,
        eventDate,
        eventTime,
        eventVenue: venueName,
        city,
        buyerName,
        buyerEmail,
        price: parentAmount,
        sectionName: parentLocalityLine,
        ...(parentBuyerId ? {buyerIdNumber: parentBuyerId} : {}),
      },
      qrCodeImage,
    });
  }

  if (ticketsWithQR.length === 0) return null;

  return {
    ticketsWithQR,
    buyerEmail,
    buyerName,
    eventName,
    eventData,
  };
}

/**
 * Resuelve el id del documento padre de una compra (para reenvío / edición).
 */
export function resolvePurchaseParentTicketId(
  ticketId: string,
  ticketData: Record<string, unknown>
): string {
  const kind = String(ticketData.ticketKind || "");
  const parentId = String(ticketData.bundleParentTicketId || "").trim();
  if (kind === "purchase_pass" && parentId) return parentId;
  return ticketId;
}
