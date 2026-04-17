import {
  addDoc,
  collection,
  getDocs,
  limit,
  orderBy,
  query,
  serverTimestamp,
  startAfter,
  Timestamp,
  where,
  type QueryDocumentSnapshot,
  type DocumentData,
} from 'firebase/firestore';
import { db } from './firebase';
import { getCurrentUser } from './auth';

/** Límite de caracteres en summary (Firestore + reglas) */
export const AUDIT_SUMMARY_MAX = 480;

export type AuditLogKind =
  | 'event_create'
  | 'event_update'
  | 'recurring_event_create'
  | 'recurring_event_update'
  | 'event_duplicate'
  | 'manual_ticket_batch'
  | 'ticket_transfer_enduser'
  | 'config_contact'
  | 'config_payment_abono'
  | 'config_payment_provider'
  | 'config_gateway_commission'
  | 'organizer_buyer_fee'
  | 'organizer_mp_seller'
  | 'event_organizer_transfer'
  | 'partner_grant_upsert'
  | 'partner_grant_delete'
  | 'admin_user_create';

export type AuditLogRow = {
  id: string;
  at: Timestamp | null;
  actorUid: string;
  actorEmail: string;
  kind: string;
  action: string;
  entityType: string;
  entityId: string;
  summary: string;
};

function clipSummary(s: string): string {
  const t = s.trim();
  return t.length <= AUDIT_SUMMARY_MAX ? t : t.slice(0, AUDIT_SUMMARY_MAX - 1) + '…';
}

/**
 * Registro append-only de auditoría. No bloquea el flujo principal ante fallo de red.
 */
export async function appendAuditLog(payload: {
  kind: AuditLogKind;
  action?: string;
  entityType: string;
  entityId: string;
  summary: string;
}): Promise<void> {
  const u = getCurrentUser();
  if (!u) return;
  await addDoc(collection(db, 'audit_logs'), {
    actorUid: u.uid,
    actorEmail: (u.email || '').slice(0, 320),
    kind: payload.kind,
    action: payload.action ?? '',
    entityType: payload.entityType,
    entityId: String(payload.entityId || '').slice(0, 200),
    summary: clipSummary(payload.summary),
    at: serverTimestamp(),
  });
}

const DEFAULT_PAGE = 35;

/**
 * Consulta paginada por rango de fechas y opcionalmente actor. Una lectura = un getDocs (hasta pageSize+1 docs).
 */
export async function fetchAuditLogsPage(params: {
  start: Timestamp;
  end: Timestamp;
  actorUid?: string;
  pageSize?: number;
  cursor?: QueryDocumentSnapshot<DocumentData> | null;
}): Promise<{ rows: AuditLogRow[]; nextCursor: QueryDocumentSnapshot<DocumentData> | null; hasMore: boolean }> {
  const pageSize = Math.min(Math.max(5, params.pageSize ?? DEFAULT_PAGE), 80);
  const lim = pageSize + 1;
  const coll = collection(db, 'audit_logs');
  const base = params.actorUid?.trim()
    ? [
        where('actorUid', '==', params.actorUid.trim()),
        where('at', '>=', params.start),
        where('at', '<=', params.end),
        orderBy('at', 'desc'),
      ]
    : [where('at', '>=', params.start), where('at', '<=', params.end), orderBy('at', 'desc')];

  const q = params.cursor
    ? query(coll, ...base, startAfter(params.cursor), limit(lim))
    : query(coll, ...base, limit(lim));

  const snap = await getDocs(q);
  const hasMore = snap.docs.length > pageSize;
  const slice = hasMore ? snap.docs.slice(0, pageSize) : snap.docs;
  const rows: AuditLogRow[] = slice.map((d) => {
    const x = d.data();
    return {
      id: d.id,
      at: (x.at as Timestamp) ?? null,
      actorUid: String(x.actorUid || ''),
      actorEmail: String(x.actorEmail || ''),
      kind: String(x.kind || ''),
      action: String(x.action || ''),
      entityType: String(x.entityType || ''),
      entityId: String(x.entityId || ''),
      summary: String(x.summary || ''),
    };
  });
  const nextCursor = slice.length ? slice[slice.length - 1] : null;
  return { rows, nextCursor, hasMore };
}

export const AUDIT_KIND_LABELS: Record<string, string> = {
  event_create: 'Evento · creación',
  event_update: 'Evento · edición',
  recurring_event_create: 'Evento recurrente · creación',
  recurring_event_update: 'Evento recurrente · edición',
  event_duplicate: 'Evento · duplicado',
  manual_ticket_batch: 'Boletos · creación manual',
  ticket_transfer_enduser: 'Boleto · transferencia (usuario)',
  config_contact: 'Config · contacto WhatsApp',
  organizer_buyer_fee: 'Config · tarifa organizador',
  organizer_mp_seller: 'Config · Mercado Pago vendedor',
  event_organizer_transfer: 'Config · traspaso de evento',
  partner_grant_upsert: 'Partner · permisos guardados',
  partner_grant_delete: 'Partner · permisos eliminados',
  admin_user_create: 'Administrador · cuenta creada',
};
