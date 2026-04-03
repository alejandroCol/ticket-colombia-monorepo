import {
  AggregateField,
  type DocumentData,
  type Firestore,
  type QuerySnapshot,
} from "firebase-admin/firestore";

/** Estados que consumen cupo (alineado con countTicketsBySection). */
export const TICKET_VALID_STATUSES: readonly string[] = [
  "paid",
  "reserved",
  "used",
  "redeemed",
];

const TICKET_VALID = TICKET_VALID_STATUSES as unknown as string[];

/** Prefijo de clave de inventario por celda de mapa (palco / subdivisión). */
export const MAP_ZONE_SLOT_PREFIX = "__mapZone__";

export function mapZoneSlotKey(mapZoneId: string): string {
  return `${MAP_ZONE_SLOT_PREFIX}${String(mapZoneId).trim()}`;
}

export type EventDataLike = DocumentData;

/**
 * Cuenta boletos vendidos/reservados por nombre de sección, o por mapa (palco) si hay mapZoneId.
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
    if (t.ticketKind === "purchase_pass") return;

    const mz = String(t.mapZoneId || "").trim();
    /** Un palco ocupa una sola celda aunque el ticket lleve varias entradas (bundle). */
    const qty = mz ? 1 : (t.quantity || 1);
    const key = mz ? mapZoneSlotKey(mz) : (t.sectionName || t.sectionId || "General");
    bySection[key] = (bySection[key] || 0) + qty;
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

    const mz = String(r.mapZoneId || "").trim();
    const qtyRaw = r.quantity || 0;
    const qty = mz ? 1 : qtyRaw;
    const key = mz ? mapZoneSlotKey(mz) : (r.sectionName || r.sectionId || "General");
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

/** Personas / QRs por palco para una localidad (mínimo 1). */
export function seatsPerUnitForSection(
  eventData: EventDataLike,
  sectionId: string
): number {
  const sid = String(sectionId || "").trim();
  if (!sid) return 1;
  const sections = eventData.sections as
    | Array<{ id: string; seats_per_unit?: number }>
    | undefined;
  const sec = sections?.find((s) => String(s.id || "").trim() === sid);
  return Math.max(1, Number(sec?.seats_per_unit) || 1);
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

/**
 * Campos denormalizados para inventario rápido (agregaciones Firestore por slot).
 * Debe coincidir con la lógica de {@link countTicketsBySection}.
 */
export function capacityBucketAndCount(params: {
  mapZoneId?: string | null;
  sectionId?: string | null;
  sectionName?: string | null;
  quantity: number;
  ticketKind?: string | null;
}): {capacityBucket: string; capacityCount: number} {
  const kind = params.ticketKind || "standard";
  if (kind === "purchase_pass") {
    return {capacityBucket: "__pass__", capacityCount: 0};
  }
  const mz = String(params.mapZoneId || "").trim();
  if (mz) {
    return {capacityBucket: mapZoneSlotKey(mz), capacityCount: 1};
  }
  const key = sectionCapacityKey(
    params.sectionId || undefined,
    params.sectionName || undefined
  );
  const qty = Math.max(1, Number(params.quantity) || 1);
  return {capacityBucket: key, capacityCount: qty};
}

/** Claves de slot a consultar por agregación (evento + mapa). */
export function allCapacitySlotKeysForEvent(eventData: EventDataLike): string[] {
  const keys = new Set<string>();
  keys.add("General");
  const sections = eventData.sections as
    | Array<{id: string; name: string}>
    | undefined;
  if (sections?.length) {
    for (const s of sections) {
      const {key} = getSectionCapacity(eventData, s.id, s.name);
      if (key) keys.add(key);
    }
  }
  const raw = eventData.venue_map as
    | {zones?: Array<{id?: string}>}
    | undefined;
  for (const z of raw?.zones || []) {
    const id = String(z?.id || "").trim();
    if (id) keys.add(mapZoneSlotKey(id));
  }
  return Array.from(keys);
}

function ticketDocMissingInventoryFields(data: DocumentData): boolean {
  return (
    typeof data.capacityBucket !== "string" ||
    typeof data.capacityCount !== "number"
  );
}

/**
 * Si hay boletos sin capacityBucket/capacityCount, hay que hacer el escaneo completo
 * para no subestimar ventas históricas.
 */
export async function availabilityNeedsLegacyTicketScan(
  db: Firestore,
  eventId: string
): Promise<boolean> {
  const bad = (snap: QuerySnapshot) =>
    snap.docs.some((d) => ticketDocMissingInventoryFields(d.data()));

  const orderedSample = async (
    dir: "asc" | "desc"
  ): Promise<{empty: boolean; legacy: boolean}> => {
    try {
      const snap = await db
        .collection("tickets")
        .where("eventId", "==", eventId)
        .orderBy("createdAt", dir)
        .limit(400)
        .get();
      return {empty: snap.empty, legacy: !snap.empty && bad(snap)};
    } catch {
      return {empty: false, legacy: true};
    }
  };

  const [oldest, newest] = await Promise.all([
    orderedSample("asc"),
    orderedSample("desc"),
  ]);
  if (oldest.legacy || newest.legacy) return true;

  if (!oldest.empty || !newest.empty) {
    return false;
  }

  const plain = await db
    .collection("tickets")
    .where("eventId", "==", eventId)
    .limit(400)
    .get();
  if (plain.empty) return false;
  return bad(plain);
}

async function loadTicketUsedBySlotAggregates(
  db: Firestore,
  eventId: string,
  eventData: EventDataLike
): Promise<Record<string, number>> {
  const slotKeys = allCapacitySlotKeysForEvent(eventData);
  const st = [...TICKET_VALID_STATUSES];
  const chunks: string[][] = [];
  for (let i = 0; i < slotKeys.length; i += 24) {
    chunks.push(slotKeys.slice(i, i + 24));
  }
  const merged: Record<string, number> = {};
  for (const batch of chunks) {
    const parts = await Promise.all(
      batch.map(async (slotKey) => {
        const snap = await db
          .collection("tickets")
          .where("eventId", "==", eventId)
          .where("capacityBucket", "==", slotKey)
          .where("ticketStatus", "in", st)
          .aggregate({used: AggregateField.sum("capacityCount")})
          .get();
        const raw = snap.data().used;
        const n = typeof raw === "number" && !Number.isNaN(raw) ? raw : 0;
        return {slotKey, n};
      })
    );
    for (const {slotKey, n} of parts) {
      merged[slotKey] = n;
    }
  }
  return merged;
}

/**
 * Tickets + reservas activas por clave de slot (misma forma que antes de fusionar con reservas).
 */
export async function loadMergedUsedFromTicketsAndReservations(
  db: Firestore,
  eventId: string,
  eventData: EventDataLike,
  existingReservationsSnap?: QuerySnapshot
): Promise<Record<string, number>> {
  const [legacy, resSnap] = await Promise.all([
    availabilityNeedsLegacyTicketScan(db, eventId),
    existingReservationsSnap
      ? Promise.resolve(existingReservationsSnap)
      : db
          .collection("ticket_reservations")
          .where("eventId", "==", eventId)
          .where("status", "==", "active")
          .get(),
  ]);
  const now = Date.now();
  const {bySection: rBy} = countActiveReservationsBySection(resSnap, now);
  let tBy: Record<string, number>;
  if (legacy) {
    const ticketsSnap = await db
      .collection("tickets")
      .where("eventId", "==", eventId)
      .get();
    tBy = countTicketsBySection(ticketsSnap).bySection;
  } else {
    tBy = await loadTicketUsedBySlotAggregates(db, eventId, eventData);
  }
  return mergedUsedBySection(tBy, rBy);
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

/** Separa claves de palco (`__mapZone__*`) del resto (secciones clásicas). */
export function partitionMergedSlots(merged: Record<string, number>): {
  bySection: Record<string, number>;
  byMapZone: Record<string, number>;
} {
  const bySection: Record<string, number> = {};
  const byMapZone: Record<string, number> = {};
  Object.entries(merged).forEach(([k, v]) => {
    if (k.startsWith(MAP_ZONE_SLOT_PREFIX)) {
      byMapZone[k.slice(MAP_ZONE_SLOT_PREFIX.length)] = v;
    } else {
      bySection[k] = v;
    }
  });
  return {bySection, byMapZone};
}

/** Zonas de mapa enlazadas a una localidad (para validar compra por palco). */
export function mapZonesForSection(
  eventData: EventDataLike,
  sectionId: string
): Array<{id: string; sectionId: string}> {
  const sid = String(sectionId || "").trim();
  if (!sid) return [];
  const raw = eventData.venue_map as {zones?: Array<{id?: string; sectionId?: string}>} | undefined;
  const zones = raw?.zones;
  if (!Array.isArray(zones)) return [];
  const out: Array<{id: string; sectionId: string}> = [];
  for (const z of zones) {
    if (!z) continue;
    const zid = String(z.id || "").trim();
    if (!zid) continue;
    if (String(z.sectionId || "").trim() !== sid) continue;
    out.push({id: zid, sectionId: sid});
  }
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
  sectionName?: string,
  mapZoneId?: string
): Promise<void> {
  const mz = String(mapZoneId || "").trim();
  if (mz) {
    const sid = String(sectionId || "").trim();
    const spu = sid ? seatsPerUnitForSection(eventData, sid) : 1;
    if (quantity !== spu) {
      throw new Error(
        `Esta localidad vende el palco completo: la cantidad debe ser ${spu} (entradas incluidas).`
      );
    }
    const merged = await loadMergedUsedFromTicketsAndReservations(
      db,
      eventId,
      eventData
    );
    const usedSlot = merged[mapZoneSlotKey(mz)] ?? 0;
    if (usedSlot >= 1) {
      throw new Error("Este palco ya no está disponible.");
    }
    return;
  }

  const {capacity, key: capKey} = getSectionCapacity(
    eventData,
    sectionId || undefined,
    sectionName || undefined
  );

  const merged = await loadMergedUsedFromTicketsAndReservations(
    db,
    eventId,
    eventData
  );
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
