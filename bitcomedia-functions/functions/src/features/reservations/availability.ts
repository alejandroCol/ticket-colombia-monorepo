import type {
  DocumentData,
  Firestore,
  QuerySnapshot,
} from "firebase-admin/firestore";

const TICKET_VALID = ["paid", "reserved", "used", "redeemed"];

export type EventDataLike = DocumentData;

/**
 * Cuenta boletos vendidos/reservados por nombre de sección (o "General").
 */
export function countTicketsBySection(
  ticketsSnap: QuerySnapshot
): { bySection: Record<string, number>; totalSold: number } {
  const bySection: Record<string, number> = {};
  let totalSold = 0;

  ticketsSnap.forEach((doc) => {
    const t = doc.data();
    const status = t.ticketStatus || t.status;
    if (!TICKET_VALID.includes(status)) return;
    if (["cancelled", "disabled"].includes(status)) return;
    if (t.transferredTo) return;

    const qty = t.quantity || 1;
    const sectionName = t.sectionName || t.sectionId || "General";
    bySection[sectionName] = (bySection[sectionName] || 0) + qty;
    totalSold += qty;
  });

  return { bySection, totalSold };
}

/**
 * Suma cantidades en reservas activas (no expiradas).
 */
export function countActiveReservationsBySection(
  reservationsSnap: QuerySnapshot,
  nowMs: number
): { bySection: Record<string, number>; totalHeld: number } {
  const bySection: Record<string, number> = {};
  let totalHeld = 0;

  reservationsSnap.forEach((doc) => {
    const r = doc.data();
    if (r.status !== "active") return;
    const exp = r.expiresAt?.toMillis?.() ?? 0;
    if (exp <= nowMs) return;

    const qty = r.quantity || 0;
    const key = r.sectionName || r.sectionId || "General";
    bySection[key] = (bySection[key] || 0) + qty;
    totalHeld += qty;
  });

  return { bySection, totalHeld };
}

/** Clave de sección para comparar con tickets (nombre o id). */
export function sectionCapacityKey(
  sectionId: string | undefined,
  sectionName: string | undefined
): string {
  return (sectionName || sectionId || "General").trim() || "General";
}

export function getSectionCapacity(
  eventData: EventDataLike,
  sectionId?: string,
  sectionName?: string
): { capacity: number; key: string } {
  const sections = eventData.sections as
    | Array<{ id: string; name: string; available: number }>
    | undefined;
  const key = sectionCapacityKey(sectionId, sectionName);

  if (sections?.length) {
    const sec =
      sections.find((s) => s.id === sectionId) ||
      sections.find((s) => s.name === sectionName) ||
      sections.find((s) => s.name === key);
    if (sec) {
      return { capacity: Number(sec.available) || 0, key: sec.name || sec.id };
    }
  }

  return {
    capacity: Number(eventData.capacity_per_occurrence) || 0,
    key: "General",
  };
}

export function mergedUsedBySection(
  ticketBy: Record<string, number>,
  resBy: Record<string, number>
): Record<string, number> {
  const keys = new Set([...Object.keys(ticketBy), ...Object.keys(resBy)]);
  const out: Record<string, number> = {};
  keys.forEach((k) => {
    out[k] = (ticketBy[k] || 0) + (resBy[k] || 0);
  });
  return out;
}

export function remainingForSection(
  capacity: number,
  usedInSection: number
): number {
  return Math.max(0, capacity - usedInSection);
}

/**
 * Cupo disponible tras consumir una reserva (tickets + reservas activas no expiradas).
 */
export function usedInSectionMerged(
  merged: Record<string, number>,
  capKey: string,
  sectionId?: string,
  sectionName?: string
): number {
  const sid = (sectionId || "").trim();
  const sname = (sectionName || "").trim();
  return (
    merged[capKey] ??
    (sname ? merged[sname] : undefined) ??
    (sid ? merged[sid] : undefined) ??
    0
  );
}

/**
 * Verifica que quepa `quantity` en la sección (servidor, al crear preferencia).
 */
export async function assertEnoughCapacityForPurchase(
  db: Firestore,
  eventId: string,
  eventData: EventDataLike,
  quantity: number,
  sectionId?: string,
  sectionName?: string
): Promise<void> {
  const {capacity, key: capKey} = getSectionCapacity(
    eventData,
    sectionId || undefined,
    sectionName || undefined
  );

  const [ticketsSnap, resSnap] = await Promise.all([
    db.collection("tickets").where("eventId", "==", eventId).get(),
    db
      .collection("ticket_reservations")
      .where("eventId", "==", eventId)
      .where("status", "==", "active")
      .get(),
  ]);

  const now = Date.now();
  const {bySection: tBy} = countTicketsBySection(ticketsSnap);
  const {bySection: rBy} = countActiveReservationsBySection(resSnap, now);
  const merged = mergedUsedBySection(tBy, rBy);
  const usedForSection = usedInSectionMerged(
    merged,
    capKey,
    sectionId,
    sectionName
  );
  const rem = remainingForSection(capacity, usedForSection);

  if (quantity > rem) {
    throw new Error(
      `No hay suficientes entradas disponibles en este momento (quedan ${rem})`
    );
  }
}
