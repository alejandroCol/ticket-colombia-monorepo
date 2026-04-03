import * as functions from "firebase-functions/v1";
import * as admin from "firebase-admin";

const DEFAULT_PERMS = {
  read_tickets: false,
  create_tickets: false,
  taquilla_sale: false,
  edit_event: false,
  view_stats: false,
  scan_validate: false,
};

function grantDocId(userId: string, isRecurring: boolean, eventId: string): string {
  const kind = isRecurring ? "rec" : "evt";
  return `${userId}_${kind}_${eventId}`;
}

async function canManagePromotersForEvent(
  uid: string,
  eventId: string,
  isRecurring: boolean
): Promise<boolean> {
  const userSnap = await admin.firestore().doc(`users/${uid}`).get();
  const role = userSnap.data()?.role as string | undefined;
  if (role === "SUPER_ADMIN") return true;
  if (role !== "ADMIN" && role !== "admin") return false;
  const coll = isRecurring ? "recurring_events" : "events";
  const ev = await admin.firestore().collection(coll).doc(eventId).get();
  if (!ev.exists) return false;
  return String(ev.data()?.organizer_id || "").trim() === uid;
}

type PermissionsInput = {
  read_tickets?: boolean;
  create_tickets?: boolean;
  taquilla_sale?: boolean;
  edit_event?: boolean;
  view_stats?: boolean;
  scan_validate?: boolean;
};

interface ManagePayload {
  action: "upsert" | "delete";
  targetUid: string;
  targetEmail: string;
  eventId: string;
  isRecurring: boolean;
  permissions?: PermissionsInput;
}

/**
 * Organizadores (y super admin) gestionan promotores vía Admin SDK: Firestore no permite
 * que un admin actualice el rol de otro usuario desde cliente.
 */
export const manageEventPromoterGrant = functions.https.onCall(
  async (data: ManagePayload, context) => {
    if (!context.auth) {
      throw new functions.https.HttpsError("unauthenticated", "Inicia sesión.");
    }
    const action = data?.action;
    const targetUid = String(data?.targetUid || "").trim();
    const targetEmail = String(data?.targetEmail || "").trim();
    const eventId = String(data?.eventId || "").trim();
    const isRecurring = !!data?.isRecurring;

    if (!targetUid || !eventId || (action !== "upsert" && action !== "delete")) {
      throw new functions.https.HttpsError(
        "invalid-argument",
        "Datos incompletos (targetUid, eventId, action)."
      );
    }

    const allowed = await canManagePromotersForEvent(context.auth.uid, eventId, isRecurring);
    if (!allowed) {
      throw new functions.https.HttpsError(
        "permission-denied",
        "No puedes gestionar promotores de este evento."
      );
    }

    const id = grantDocId(targetUid, isRecurring, eventId);
    const ref = admin.firestore().doc(`event_partner_grants/${id}`);

    if (action === "delete") {
      await ref.delete();
      const leftover = await admin
        .firestore()
        .collection("event_partner_grants")
        .where("user_id", "==", targetUid)
        .limit(1)
        .get();
      if (leftover.empty) {
        await admin.firestore().doc(`users/${targetUid}`).update({ role: "USER" }).catch(() => undefined);
      }
      return { success: true };
    }

    const raw = data.permissions || {};
    const permissions = {
      read_tickets: !!raw.read_tickets,
      create_tickets: !!raw.create_tickets,
      taquilla_sale: !!raw.taquilla_sale,
      edit_event: !!raw.edit_event,
      view_stats: !!raw.view_stats,
      scan_validate: !!raw.scan_validate,
    };

    if (!targetEmail) {
      throw new functions.https.HttpsError(
        "invalid-argument",
        "El correo del promotor es obligatorio."
      );
    }

    const now = admin.firestore.FieldValue.serverTimestamp();
    const existing = await ref.get();
    await ref.set(
      {
        user_id: targetUid,
        event_id: eventId,
        event_path: isRecurring ? "recurring_events" : "events",
        partner_email: targetEmail,
        permissions: { ...DEFAULT_PERMS, ...permissions },
        updated_at: now,
        ...(existing.exists ? {} : { created_at: now }),
      },
      { merge: true }
    );

    await admin.firestore().doc(`users/${targetUid}`).update({ role: "PARTNER" });

    return { success: true };
  }
);
