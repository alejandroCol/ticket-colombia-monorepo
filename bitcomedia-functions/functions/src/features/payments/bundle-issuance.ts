import * as admin from "firebase-admin";
import {randomUUID} from "crypto";
import type {QRCodeGenerator, TicketRepository} from "./types";
import {capacityBucketAndCount} from "../reservations/availability";

export type TicketDocLike = Record<string, unknown>;

/**
 * Tras pago completo: si hay más de un pase (palco / grupo), crea tickets hijos con QR cada uno.
 * Si es 1 pase, deja el documento padre como ticket estándar con un solo QR.
 */
export async function finalizePaidTicketsWithBundle(
  db: admin.firestore.Firestore,
  parentTicketId: string,
  parentData: TicketDocLike,
  qrGenerator: QRCodeGenerator,
  appUrl: string,
  ticketRepository: TicketRepository
): Promise<void> {
  const parentRef = db.collection("tickets").doc(parentTicketId);
  const finalizeLockRef = parentRef
    .collection("_idempotency")
    .doc("finalize_paid_bundle");

  let lockAcquired = false;
  try {
    await db.runTransaction(async (tx) => {
      const ls = await tx.get(finalizeLockRef);
      if (ls.exists) {
        lockAcquired = false;
        return;
      }
      tx.create(finalizeLockRef, {
        at: admin.firestore.FieldValue.serverTimestamp(),
      });
      lockAcquired = true;
    });
  } catch (e) {
    console.error("[finalizePaidTicketsWithBundle] lock tx", e);
    throw e;
  }

  if (!lockAcquired) {
    console.log(
      "[finalizePaidTicketsWithBundle] Idempotente: ya finalizado (webhook duplicado)",
      parentTicketId
    );
    return;
  }

  try {
    const freshSnap = await parentRef.get();
    const pd = (freshSnap.data() as TicketDocLike) || parentData;

    const seatsPerUnit = Math.max(1, Number(pd.seatsPerUnit) || 1);
    const units = Math.max(1, Number(pd.quantity) || 1);
    const mapZoneId = String(pd.mapZoneId || "").trim();
    /**
     * Debe coincidir con Checkout `qrTotal`: en mapa/palco, `quantity` ya es el total de
     * pases del bloque (se fuerza a seats_per_unit al elegir la zona). Sin mapa, cada
     * unidad comprada aporta `seatsPerUnit` QRs (p. ej. varios grupos).
     */
    const passCount = mapZoneId ? units : seatsPerUnit * units;

    if (passCount <= 1) {
      const qrCode = await qrGenerator.generateQRCode(parentTicketId, appUrl);
      await ticketRepository.update(parentTicketId, {
        qrCode,
        ticketStatus: "paid",
        ticketKind: "standard",
        ...capacityBucketAndCount({
          mapZoneId: String(pd.mapZoneId || "").trim(),
          sectionId: (pd.sectionId as string) ?? null,
          sectionName: (pd.sectionName as string) ?? null,
          quantity: units,
          ticketKind: "standard",
        }),
      });
      return;
    }

    const childIds: string[] = [];
    const qrUrls: string[] = [];
    for (let i = 0; i < passCount; i++) {
      const id = randomUUID();
      childIds.push(id);
      qrUrls.push(await qrGenerator.generateQRCode(id, appUrl));
    }

    const batch = db.batch();

    for (let i = 0; i < passCount; i++) {
      const id = childIds[i];
      const ref = db.collection("tickets").doc(id);
      batch.set(ref, {
        userId: pd.userId,
        eventId: pd.eventId,
        buyerEmail: pd.buyerEmail,
        preferenceId: pd.preferenceId,
        paymentId: pd.paymentId,
        paymentStatus: pd.paymentStatus || "approved",
        paymentMethod: pd.paymentMethod || "",
        amount: 0,
        quantity: 1,
        currency: pd.currency || "COP",
        ticketStatus: "paid",
        qrCode: qrUrls[i],
        initPoint: pd.initPoint || `${appUrl}/tickets`,
        metadata: pd.metadata || {},
        sectionId: pd.sectionId,
        sectionName: pd.sectionName || "",
        mapZoneId: "",
        transferredTo: null,
        ...capacityBucketAndCount({
          mapZoneId: "",
          sectionId: (pd.sectionId as string) ?? null,
          sectionName: (pd.sectionName as string) ?? null,
          quantity: 1,
          ticketKind: "purchase_pass",
        }),
        ticketKind: "purchase_pass",
        bundleParentTicketId: parentTicketId,
        passIndex: i + 1,
        passCount,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        ...(pd.mpSplitOrganizerId ? {mpSplitOrganizerId: pd.mpSplitOrganizerId} : {}),
      });
    }

    batch.update(parentRef, {
      ticketKind: "purchase_bundle_parent",
      childTicketIds: childIds,
      qrCode: "",
      ticketStatus: "paid",
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    await batch.commit();
  } catch (e) {
    await finalizeLockRef.delete().catch(() => undefined);
    throw e;
  }
}
