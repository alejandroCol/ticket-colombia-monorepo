import * as functions from "firebase-functions/v1";
import * as admin from "firebase-admin";
import {
  expectedTotalCOP,
  totalChargedWithTicketDiscount,
  buyerFeeFixedUnitCountFromRequest,
  unitPriceFromEventData,
  ticketLineSubtotalCOP,
  type OrganizerBuyerFeeInput,
} from "../payments/pricing-from-event";
import {
  loadEventDiscountCode,
  computeDiscountAmountCOPFromDoc,
  assertDiscountCodeSchedulable,
} from "./discount-code-helpers";

async function loadOrganizerBuyerFeeForPreview(
  db: admin.firestore.Firestore,
  organizerId: string
): Promise<OrganizerBuyerFeeInput> {
  const id = String(organizerId || "").trim();
  if (!id) return null;
  const snap = await db.collection("organizer_buyer_fees").doc(id).get();
  if (!snap.exists) return null;
  const d = snap.data()!;
  const t = String(d.fee_type || "").trim();
  const v = Number(d.fee_value) || 0;
  if (!t || t === "none" || v <= 0) return null;
  if (t !== "percent_payer" && t !== "fixed_per_ticket") return null;
  return {type: t, value: v};
}

export type PreviewEventDiscountInput = {
  eventId?: string;
  code?: string;
  quantity?: number;
  sectionId?: string;
  mapZoneId?: string;
};

/**
 * Vista previa del cupón (totales alineados con createTicketPreference).
 * Público: no expone otros cupones ni permite adivinar códigos más allá de probar uno.
 */
export const previewEventDiscountCode = functions.https.onCall(
  async (data: PreviewEventDiscountInput) => {
    const eventId = String(data?.eventId || "").trim();
    const code = String(data?.code || "").trim();
    const quantity = Math.max(1, Math.floor(Number(data?.quantity) || 1));
    const sectionId = data?.sectionId?.trim() || undefined;
    const mapZoneId = data?.mapZoneId?.trim() || undefined;

    if (!eventId || !code) {
      throw new functions.https.HttpsError(
        "invalid-argument",
        "eventId y código son obligatorios"
      );
    }

    const db = admin.firestore();
    let eventDoc = await db.collection("events").doc(eventId).get();
    if (!eventDoc.exists) {
      eventDoc = await db.collection("recurring_events").doc(eventId).get();
    }
    if (!eventDoc.exists) {
      throw new functions.https.HttpsError("not-found", "Evento no encontrado");
    }
    const eventData = eventDoc.data()!;

    const unitPriceCOP = unitPriceFromEventData(eventData, sectionId);
    const subtotalCOP = ticketLineSubtotalCOP(
      eventData,
      sectionId,
      mapZoneId,
      unitPriceCOP,
      quantity
    );

    if (subtotalCOP <= 0) {
      throw new functions.https.HttpsError(
        "failed-precondition",
        "Los cupones no aplican a entradas gratuitas"
      );
    }

    const loaded = await loadEventDiscountCode(db, eventId, code);
    if (!loaded) {
      throw new functions.https.HttpsError("not-found", "Cupón no válido");
    }

    try {
      assertDiscountCodeSchedulable(loaded.data, Date.now());
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Cupón no disponible";
      throw new functions.https.HttpsError("failed-precondition", msg);
    }

    const discountCOP = computeDiscountAmountCOPFromDoc(subtotalCOP, loaded.data);
    if (discountCOP <= 0) {
      throw new functions.https.HttpsError(
        "failed-precondition",
        "Este cupón no aplica a esta compra"
      );
    }

    const payCfgSnap = await db.collection("configurations").doc("payments_config").get();
    const rawGlobalFees = payCfgSnap.exists ? Number(payCfgSnap.data()?.fees) : 9;
    const globalFeesPercent = Number.isFinite(rawGlobalFees) ? rawGlobalFees : 9;
    const organizerFee = await loadOrganizerBuyerFeeForPreview(
      db,
      String(eventData.organizer_id || "")
    );
    const feeFixedUnits = buyerFeeFixedUnitCountFromRequest(
      quantity,
      eventData,
      sectionId,
      mapZoneId
    );
    const priced = expectedTotalCOP(
      subtotalCOP,
      quantity,
      eventData,
      globalFeesPercent,
      organizerFee,
      feeFixedUnits
    );
    const {totalChargedCOP, discountedSubtotalCOP} = totalChargedWithTicketDiscount(
      subtotalCOP,
      priced.feeCOP,
      discountCOP,
      eventData
    );

    return {
      discountCOP,
      listSubtotalCOP: subtotalCOP,
      discountedSubtotalCOP,
      serviceFeeCOP: priced.feeCOP,
      totalCOP: totalChargedCOP,
    };
  }
);
