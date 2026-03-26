import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  query,
  setDoc,
  Timestamp,
  where,
} from 'firebase/firestore';
import { db, updateUserDocument } from './firestore';
import type { UserData } from './types';

/** Permisos por evento para usuarios PARTNER (ajustables desde super admin). */
export interface PartnerEventPermissions {
  read_tickets: boolean;
  create_tickets: boolean;
  edit_event: boolean;
  view_stats: boolean;
  scan_validate: boolean;
}

export interface PartnerEventGrant {
  id: string;
  user_id: string;
  event_id: string;
  event_path: 'events' | 'recurring_events';
  partner_email?: string;
  permissions: PartnerEventPermissions;
  created_at?: Timestamp;
  updated_at?: Timestamp;
}

export const DEFAULT_PARTNER_PERMISSIONS: PartnerEventPermissions = {
  read_tickets: false,
  create_tickets: false,
  edit_event: false,
  view_stats: false,
  scan_validate: false,
};

export function partnerGrantDocId(userId: string, isRecurring: boolean, eventId: string): string {
  const kind = isRecurring ? 'rec' : 'evt';
  return `${userId}_${kind}_${eventId}`;
}

export async function getPartnerGrantForEvent(
  userId: string,
  eventId: string,
  isRecurring: boolean
): Promise<PartnerEventGrant | null> {
  const id = partnerGrantDocId(userId, isRecurring, eventId);
  const snap = await getDoc(doc(db, 'event_partner_grants', id));
  if (!snap.exists()) return null;
  const data = snap.data();
  return {
    id: snap.id,
    user_id: data.user_id,
    event_id: data.event_id,
    event_path: data.event_path,
    partner_email: data.partner_email,
    permissions: { ...DEFAULT_PARTNER_PERMISSIONS, ...data.permissions },
    created_at: data.created_at,
    updated_at: data.updated_at,
  };
}

/** Resuelve concesión probando evento puntual y recurrente (p. ej. boletos por eventId). */
export async function getAnyPartnerGrantForTicketEvent(
  userId: string,
  eventId: string
): Promise<{ grant: PartnerEventGrant; isRecurring: boolean } | null> {
  for (const isRecurring of [false, true] as const) {
    const grant = await getPartnerGrantForEvent(userId, eventId, isRecurring);
    if (grant) return { grant, isRecurring };
  }
  return null;
}

export async function partnerCanReadTicket(userId: string, eventId: string): Promise<boolean> {
  const p = await getAnyPartnerGrantForTicketEvent(userId, eventId);
  if (!p) return false;
  const { read_tickets, scan_validate } = p.grant.permissions;
  return read_tickets || scan_validate;
}

export async function partnerCanValidateTicket(userId: string, eventId: string): Promise<boolean> {
  const p = await getAnyPartnerGrantForTicketEvent(userId, eventId);
  return !!p?.grant.permissions.scan_validate;
}

export async function listPartnerGrantsForUser(userId: string): Promise<PartnerEventGrant[]> {
  const q = query(collection(db, 'event_partner_grants'), where('user_id', '==', userId));
  const snap = await getDocs(q);
  const out: PartnerEventGrant[] = [];
  snap.forEach((d) => {
    const data = d.data();
    out.push({
      id: d.id,
      user_id: data.user_id,
      event_id: data.event_id,
      event_path: data.event_path,
      partner_email: data.partner_email,
      permissions: { ...DEFAULT_PARTNER_PERMISSIONS, ...data.permissions },
      created_at: data.created_at,
      updated_at: data.updated_at,
    });
  });
  return out;
}

export async function listAllPartnerGrants(): Promise<PartnerEventGrant[]> {
  const snap = await getDocs(collection(db, 'event_partner_grants'));
  const out: PartnerEventGrant[] = [];
  snap.forEach((d) => {
    const data = d.data();
    out.push({
      id: d.id,
      user_id: data.user_id,
      event_id: data.event_id,
      event_path: data.event_path,
      partner_email: data.partner_email,
      permissions: { ...DEFAULT_PARTNER_PERMISSIONS, ...data.permissions },
      created_at: data.created_at,
      updated_at: data.updated_at,
    });
  });
  out.sort((a, b) => (b.updated_at?.toMillis() || 0) - (a.updated_at?.toMillis() || 0));
  return out;
}

export async function upsertPartnerGrant(params: {
  targetUid: string;
  targetEmail: string;
  eventId: string;
  isRecurring: boolean;
  permissions: PartnerEventPermissions;
}): Promise<void> {
  const { targetUid, targetEmail, eventId, isRecurring, permissions } = params;
  const id = partnerGrantDocId(targetUid, isRecurring, eventId);
  const ref = doc(db, 'event_partner_grants', id);
  const existing = await getDoc(ref);
  const now = Timestamp.now();
  await setDoc(
    ref,
    {
      user_id: targetUid,
      event_id: eventId,
      event_path: isRecurring ? 'recurring_events' : 'events',
      partner_email: targetEmail,
      permissions,
      updated_at: now,
      ...(existing.exists() ? {} : { created_at: now }),
    },
    { merge: true }
  );
  await updateUserDocument(targetUid, { role: 'PARTNER' });
}

export async function deletePartnerGrant(
  targetUid: string,
  eventId: string,
  isRecurring: boolean
): Promise<void> {
  const id = partnerGrantDocId(targetUid, isRecurring, eventId);
  await deleteDoc(doc(db, 'event_partner_grants', id));
  const remaining = await listPartnerGrantsForUser(targetUid);
  if (remaining.length === 0) {
    try {
      await updateUserDocument(targetUid, { role: 'USER' });
    } catch {
      /* ignore */
    }
  }
}

/** Usuarios a los que el super admin puede asignar rol partner (excluye super admin en UI). */
export async function getPartnerCandidateUsers(): Promise<UserData[]> {
  const usersRef = collection(db, 'users');
  const [sUser, sPartner] = await Promise.all([
    getDocs(query(usersRef, where('role', '==', 'USER'))),
    getDocs(query(usersRef, where('role', '==', 'PARTNER'))),
  ]);
  const map = new Map<string, UserData>();
  const add = (d: { id: string; data: () => Record<string, unknown> }) => {
    const raw = d.data() as UserData;
    map.set(d.id, { ...raw, uid: d.id });
  };
  sUser.forEach((d) => add(d));
  sPartner.forEach((d) => add(d));
  return Array.from(map.values()).sort((a, b) =>
    (a.email || '').localeCompare(b.email || '', 'es')
  );
}
