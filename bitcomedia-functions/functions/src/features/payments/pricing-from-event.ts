import type { DocumentData } from "firebase-admin/firestore";

/**
 * Precio unitario del evento según localidad (misma lógica que checkout público).
 */
/**
 * Subtotal de la línea de compra (COP).
 * Con mapZoneId y localidad multipersona (palcos divididos), `sections[].price` es el
 * precio total del palco (incluye las N personas); no se multiplica por `quantity`.
 */
export function ticketLineSubtotalCOP(
  eventData: DocumentData,
  sectionId: string | undefined,
  mapZoneId: string | undefined,
  unitPriceCOP: number,
  quantity: number
): number {
  const mz = String(mapZoneId || "").trim();
  const sid = String(sectionId || "").trim();
  const qty = Math.max(1, Math.floor(Number(quantity) || 1));
  const base = Math.max(0, Math.round(Number(unitPriceCOP) || 0));
  if (!mz || !sid) {
    return Math.round(base * qty);
  }
  const sections = eventData.sections as
    | Array<{
        id: string;
        palco_multipersona?: boolean;
        seats_per_unit?: number;
      }>
    | undefined;
  const sec = sections?.find((s) => String(s.id || "").trim() === sid);
  const spu = Math.max(1, Number(sec?.seats_per_unit) || 1);
  if (sec?.palco_multipersona === true && spu > 1) {
    return base;
  }
  return Math.round(base * qty);
}

/**
 * Unidades para tarifa fija por entrada (palco multipersona sin mapa: `quantity` × N personas).
 * Con `mapZoneId`, `quantity` de la reserva ya cuenta N personas de un palco.
 */
export function buyerFeeFixedUnitCountFromRequest(
  quantity: number,
  eventData: DocumentData,
  sectionId?: string,
  mapZoneId?: string
): number {
  const q = Math.max(1, Math.floor(Number(quantity) || 1));
  const sid = String(sectionId || "").trim();
  const mz = String(mapZoneId || "").trim();
  const sections = eventData.sections as
    | Array<{
        id: string;
        palco_multipersona?: boolean;
        seats_per_unit?: number;
      }>
    | undefined;
  const sec = sections?.find((s) => String(s.id || "").trim() === sid);
  const n = Math.max(1, Number(sec?.seats_per_unit) || 1);
  const palcoMulti = sec?.palco_multipersona === true && n > 1;
  if (!palcoMulti) return q;
  if (mz) return q;
  return q * n;
}

export function unitPriceFromEventData(
  eventData: DocumentData,
  sectionId?: string
): number {
  const sections = eventData.sections as
    | Array<{ id: string; price?: number }>
    | undefined;
  if (sectionId && sections?.length) {
    const sec = sections.find((s) => s.id === sectionId);
    if (sec != null && typeof sec.price === "number") {
      return Math.max(0, Math.round(sec.price));
    }
  }
  return Math.max(0, Math.round(Number(eventData.ticket_price) || 0));
}

export type ServiceFeeSource =
  | "event_percent"
  | "event_fixed"
  | "organizer_percent"
  | "organizer_fixed"
  | "global_percent";

/** Tarifa por organizador (super admin); lectura pública vía colección organizer_buyer_fees */
export type OrganizerBuyerFeeInput = {
  type: string;
  value: number;
} | null;

/**
 * Tarifa cobrada al comprador sobre el subtotal (entradas).
 * Prioridad: override por evento (super admin) → tarifa del organizador → % global payments_config.
 */
export function computeServiceFeeCOP(
  subtotalCOP: number,
  quantity: number,
  eventData: DocumentData,
  globalFeesPercent: number,
  organizerFee: OrganizerBuyerFeeInput = null,
  fixedFeeUnitCount?: number
): { feeCOP: number; source: ServiceFeeSource; effectivePercent?: number; fixedPerTicket?: number } {
  const qty = Math.max(1, quantity);
  const qFixed = Math.max(1, fixedFeeUnitCount ?? qty);
  const type = String(eventData.platform_commission_type || "").trim();
  const value = Number(eventData.platform_commission_value) || 0;

  if (type === "percent_payer" && value > 0) {
    return {
      feeCOP: Math.round(subtotalCOP * (value / 100)),
      source: "event_percent",
      effectivePercent: value,
    };
  }
  if (type === "fixed_per_ticket" && value > 0) {
    return {
      feeCOP: Math.round(value * qFixed),
      source: "event_fixed",
      fixedPerTicket: value,
    };
  }

  const oType = String(organizerFee?.type || "").trim();
  const oVal = Number(organizerFee?.value) || 0;
  if (oType === "percent_payer" && oVal > 0) {
    return {
      feeCOP: Math.round(subtotalCOP * (oVal / 100)),
      source: "organizer_percent",
      effectivePercent: oVal,
    };
  }
  if (oType === "fixed_per_ticket" && oVal > 0) {
    return {
      feeCOP: Math.round(oVal * qFixed),
      source: "organizer_fixed",
      fixedPerTicket: oVal,
    };
  }

  const pct = Math.max(0, Number(globalFeesPercent) || 0);
  return {
    feeCOP: Math.round(subtotalCOP * (pct / 100)),
    source: "global_percent",
    effectivePercent: pct,
  };
}

export function expectedTotalCOP(
  subtotalCOP: number,
  quantity: number,
  eventData: DocumentData,
  globalFeesPercent: number,
  organizerFee: OrganizerBuyerFeeInput = null,
  fixedFeeUnitCount?: number
): { subtotal: number; feeCOP: number; total: number; feeSource: ServiceFeeSource } {
  const sub = Math.max(0, Math.round(subtotalCOP));
  const { feeCOP, source } = computeServiceFeeCOP(
    sub,
    quantity,
    eventData,
    globalFeesPercent,
    organizerFee,
    fixedFeeUnitCount
  );
  return {
    subtotal: sub,
    feeCOP,
    total: sub + feeCOP,
    feeSource: source,
  };
}
