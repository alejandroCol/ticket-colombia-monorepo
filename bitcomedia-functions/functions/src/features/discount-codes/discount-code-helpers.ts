import * as admin from "firebase-admin";

/** Doc en `events|recurring_events/{eventId}/discount_codes/{codeId}` */
export type EventDiscountCodeDoc = {
  type: "percent" | "fixed_cop";
  value: number;
  active: boolean;
  maxRedemptions: number | null;
  redeemedCount: number;
  expiresAt?: admin.firestore.Timestamp | null;
  createdAt?: admin.firestore.Timestamp;
  updatedAt?: admin.firestore.Timestamp;
};

export function normalizeDiscountCode(raw: string): string {
  return String(raw || "")
    .trim()
    .toUpperCase()
    .replace(/\s+/g, "");
}

/**
 * Descuento en COP sobre la línea de entradas (nunca sobre la tarifa tiquetera).
 */
export function computeDiscountAmountCOPFromDoc(
  listSubtotalCOP: number,
  data: EventDiscountCodeDoc
): number {
  const list = Math.max(0, Math.round(listSubtotalCOP));
  if (list <= 0) return 0;
  const t = String(data.type || "").trim();
  const val = Number(data.value) || 0;
  if (val <= 0) return 0;
  if (t === "percent") {
    const pct = Math.min(100, Math.max(0, val));
    return Math.min(list, Math.round((list * pct) / 100));
  }
  if (t === "fixed_cop") {
    return Math.min(list, Math.round(val));
  }
  return 0;
}

export function assertDiscountCodeSchedulable(
  data: EventDiscountCodeDoc,
  nowMs: number
): void {
  if (data.active === false) {
    throw new Error("Este cupón está desactivado.");
  }
  const exp = data.expiresAt;
  if (exp && typeof exp.toMillis === "function" && exp.toMillis() < nowMs) {
    throw new Error("Este cupón ya venció.");
  }
  const max = data.maxRedemptions;
  const used = Math.max(0, Math.round(Number(data.redeemedCount) || 0));
  if (max != null && Number(max) >= 0 && used >= Number(max)) {
    throw new Error("Este cupón ya no tiene usos disponibles.");
  }
}

export async function loadEventDiscountCode(
  db: admin.firestore.Firestore,
  eventId: string,
  rawCode: string
): Promise<{
  root: "events" | "recurring_events";
  id: string;
  data: EventDiscountCodeDoc;
} | null> {
  const id = normalizeDiscountCode(rawCode);
  if (!id) return null;
  for (const root of ["events", "recurring_events"] as const) {
    const snap = await db
      .collection(root)
      .doc(eventId)
      .collection("discount_codes")
      .doc(id)
      .get();
    if (snap.exists) {
      return {root, id, data: snap.data() as EventDiscountCodeDoc};
    }
  }
  return null;
}

export async function redeemEventDiscountOnPaidTicket(
  db: admin.firestore.Firestore,
  ticketId: string,
  ticket: Record<string, unknown>
): Promise<void> {
  const codeId = String(ticket.discountCodeDocId || "").trim();
  const root = String(ticket.discountEventCollection || "").trim();
  const eventId = String(ticket.eventId || "").trim();
  if (
    !codeId ||
    !eventId ||
    (root !== "events" && root !== "recurring_events") ||
    ticket.discountRedemptionApplied === true
  ) {
    return;
  }

  const codeRef = db.collection(root).doc(eventId).collection("discount_codes").doc(codeId);
  const ticketRef = db.collection("tickets").doc(ticketId);

  try {
    await db.runTransaction(async (tx) => {
      const [cSnap, tSnap] = await Promise.all([tx.get(codeRef), tx.get(ticketRef)]);
      if (!cSnap.exists || !tSnap.exists) return;
      const t = (tSnap.data() || {}) as Record<string, unknown>;
      if (t.discountRedemptionApplied === true) return;

      const c = (cSnap.data() || {}) as EventDiscountCodeDoc;
      const max = c.maxRedemptions;
      const count = Math.max(0, Math.round(Number(c.redeemedCount) || 0));
      const capOk = max == null || Number(max) < 0 || count < Number(max);
      if (capOk) {
        tx.update(codeRef, {
          redeemedCount: admin.firestore.FieldValue.increment(1),
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        });
      } else {
        console.warn("[discount] Cupón sin cupo al redimir (carrera); ticket ya pagado", {
          ticketId,
          codeId,
        });
      }
      tx.update(ticketRef, {
        discountRedemptionApplied: true,
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      });
    });
  } catch (e) {
    console.error("[discount] redeemEventDiscountOnPaidTicket", ticketId, e);
  }
}
