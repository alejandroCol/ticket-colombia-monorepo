import {
  getFirestore,
  doc,
  getDoc,
  setDoc,
  updateDoc,
  collection,
  getDocs,
  addDoc,
  query,
  where,
  limit,
  deleteDoc,
  serverTimestamp,
} from 'firebase/firestore';

export interface BannerItem {
  id?: string;
  url: string;
  order?: number;
}
import type { UserData, Event, Venue } from './types';
import { app } from './firebase';

// Initialize Firestore
const db = getFirestore(app);

/**
 * Firestore service responsible for database operations
 */

// Get user data from Firestore
export const getUserData = async (uid: string): Promise<UserData | null> => {
  try {
    const userDocRef = doc(db, 'users', uid);
    const userDoc = await getDoc(userDocRef);
    
    if (userDoc.exists()) {
      return { uid, ...userDoc.data() } as UserData;
    }
    
    // If no user document exists, return null
    return null;
    
  } catch (error) {
    console.error('Error fetching user data:', error);
    return null;
  }
};

// Create user document in Firestore
export const createUserDocument = async (userData: UserData): Promise<void> => {
  try {
    const { uid, ...data } = userData;
    const userDocRef = doc(db, 'users', uid);
    
    // Create the user document
    await setDoc(userDocRef, data);
  } catch (error) {
    console.error('Error creating user document:', error);
    throw error;
  }
};

// Update user document in Firestore
export const updateUserDocument = async (uid: string, userData: Partial<UserData>): Promise<void> => {
  try {
    const userDocRef = doc(db, 'users', uid);
    
    // Update the user document
    await updateDoc(userDocRef, userData);
  } catch (error) {
    console.error('Error updating user document:', error);
    throw error;
  }
};

/** Listado de usuarios con rol administrador (panel taquilla). Uso: super admin. */
export const getAdminUsersList = async (): Promise<UserData[]> => {
  const usersRef = collection(db, 'users');
  const roles = ['ADMIN', 'admin'] as const;
  const byUid = new Map<string, UserData>();
  for (const role of roles) {
    const q = query(usersRef, where('role', '==', role), limit(200));
    const snap = await getDocs(q);
    snap.forEach((d) => {
      byUid.set(d.id, { uid: d.id, ...d.data() } as UserData);
    });
  }
  return [...byUid.values()].sort((a, b) => (a.email || '').localeCompare(b.email || ''));
};

/**
 * Usuarios que pueden aparecer como `actorUid` en audit_logs (super admin, admins, partners).
 * Uso: filtro en Registro de actividad. Una consulta con `in` (máx. 10 valores en Firestore).
 */
export const getAuditActorUsersList = async (): Promise<UserData[]> => {
  const usersRef = collection(db, 'users');
  const q = query(
    usersRef,
    where('role', 'in', ['SUPER_ADMIN', 'ADMIN', 'admin', 'PARTNER']),
    limit(500)
  );
  const snap = await getDocs(q);
  const list: UserData[] = [];
  snap.forEach((d) => {
    list.push({ uid: d.id, ...d.data() } as UserData);
  });
  return list.sort((a, b) => (a.email || '').localeCompare(b.email || ''));
};

function eventDateMillis(ev: Event): number {
  const ed = ev.event_date as unknown;
  if (ed && typeof ed === 'object' && ed !== null && 'toMillis' in ed) {
    const fn = (ed as { toMillis?: () => number }).toMillis;
    if (typeof fn === 'function') return fn.call(ed);
  }
  if (ed instanceof Date) return ed.getTime();
  return 0;
}

function sortEventsNewestFirst(list: Event[]): Event[] {
  return [...list].sort((a, b) => eventDateMillis(b) - eventDateMillis(a));
}

/** Eventos normales y recurrentes agrupados por `organizer_id` (super admin / configuración). */
export type OrganizerEventsIndex = {
  standalone: Record<string, Event[]>;
  recurring: Record<string, Event[]>;
};

const MAX_EVENTS_ORGANIZER_INDEX = 1200;
const MAX_RECURRING_ORGANIZER_INDEX = 400;

export const fetchOrganizerEventsIndex = async (): Promise<OrganizerEventsIndex> => {
  const evRef = collection(db, 'events');
  const recRef = collection(db, 'recurring_events');
  const [evSnap, recSnap] = await Promise.all([
    getDocs(query(evRef, limit(MAX_EVENTS_ORGANIZER_INDEX))),
    getDocs(query(recRef, limit(MAX_RECURRING_ORGANIZER_INDEX))),
  ]);
  const standalone: Record<string, Event[]> = {};
  const recurring: Record<string, Event[]> = {};
  evSnap.forEach((d) => {
    const e = { id: d.id, ...d.data() } as Event;
    const oid = String(e.organizer_id || '').trim() || '_sin_organizador';
    if (!standalone[oid]) standalone[oid] = [];
    standalone[oid].push(e);
  });
  recSnap.forEach((d) => {
    const e = { id: d.id, ...d.data() } as Event;
    const oid = String(e.organizer_id || '').trim() || '_sin_organizador';
    if (!recurring[oid]) recurring[oid] = [];
    recurring[oid].push(e);
  });
  Object.keys(standalone).forEach((k) => {
    standalone[k] = sortEventsNewestFirst(standalone[k]);
  });
  Object.keys(recurring).forEach((k) => {
    recurring[k] = sortEventsNewestFirst(recurring[k]);
  });
  return { standalone, recurring };
};

/** Reasigna un evento o plantilla recurrente a otro admin (`organizer_id`). */
export const setEventOrganizerId = async (
  coll: 'events' | 'recurring_events',
  eventId: string,
  newOrganizerId: string
): Promise<void> => {
  const id = String(eventId || '').trim();
  const oid = String(newOrganizerId || '').trim();
  if (!id || !oid) throw new Error('Evento u organizador inválido');
  await updateDoc(doc(db, coll, id), { organizer_id: oid });
};

// Get event data from Firestore (events collection only)
export const getEventById = async (eventId: string): Promise<Event | null> => {
  try {
    const eventDocRef = doc(db, 'events', eventId);
    const eventDoc = await getDoc(eventDocRef);
    
    if (eventDoc.exists()) {
      // Return the document data with the id
      return { id: eventId, ...eventDoc.data() } as Event;
    }
    
    // If no event document exists, return null
    return null;
    
  } catch (error) {
    console.error('Error fetching event data:', error);
    return null;
  }
};

// Get event from events or recurring_events (for pages that receive id from either)
export const getEventOrRecurringById = async (eventId: string): Promise<Event | null> => {
  const fromEvents = await getEventById(eventId);
  if (fromEvents) return fromEvents;
  try {
    const recRef = doc(db, 'recurring_events', eventId);
    const recSnap = await getDoc(recRef);
    if (recSnap.exists()) {
      return { id: recSnap.id, ...recSnap.data() } as Event;
    }
  } catch {
    // ignore
  }
  return null;
};

/** Indica en qué colección está el documento del evento (para rutas y subnav). */
export const resolveEventCollection = async (
  eventId: string
): Promise<'events' | 'recurring_events' | null> => {
  const fromEvents = await getEventById(eventId);
  if (fromEvents) return 'events';
  try {
    const recRef = doc(db, 'recurring_events', eventId);
    const recSnap = await getDoc(recRef);
    if (recSnap.exists()) return 'recurring_events';
  } catch {
    // ignore
  }
  return null;
};

export type AdminPaymentConfig = {
  fees: number;
  taxes: number;
  /** Checkout en línea: backend usará esta pasarela */
  payment_provider: 'mercadopago' | 'onepay';
};

// Get payment configuration from Firestore
export const getPaymentConfig = async (): Promise<AdminPaymentConfig | null> => {
  try {
    const configDocRef = doc(db, 'configurations', 'payments_config');
    const configDoc = await getDoc(configDocRef);
    
    if (configDoc.exists()) {
      const data = configDoc.data();
      const rawProvider = String(data.payment_provider || 'mercadopago').toLowerCase();
      return {
        fees: data.fees || 0,
        taxes: data.taxes || 0,
        payment_provider: rawProvider === 'onepay' ? 'onepay' : 'mercadopago',
      };
    }
    
    return {
      fees: 9,
      taxes: 19,
      payment_provider: 'mercadopago',
    };
    
  } catch (error) {
    console.error('Error fetching payment config:', error);
    return {
      fees: 9,
      taxes: 19,
      payment_provider: 'mercadopago',
    };
  }
};

export const updatePaymentProviderConfig = async (payment_provider: 'mercadopago' | 'onepay'): Promise<void> => {
  const ref = doc(db, 'configurations', 'payments_config');
  const snap = await getDoc(ref);
  const base = snap.exists() ? snap.data() : {};
  await setDoc(
    ref,
    {
      ...base,
      payment_provider: payment_provider === 'onepay' ? 'onepay' : 'mercadopago',
    },
    { merge: true }
  );
};

/** Tarifa al comprador por organizador (super admin). Lectura pública en la app. */
export type OrganizerBuyerFeeDoc = {
  fee_type: 'percent_payer' | 'fixed_per_ticket';
  fee_value: number;
};

export const getOrganizerBuyerFee = async (
  organizerId: string
): Promise<OrganizerBuyerFeeDoc | null> => {
  try {
    const id = String(organizerId || '').trim();
    if (!id) return null;
    const ref = doc(db, 'organizer_buyer_fees', id);
    const snap = await getDoc(ref);
    if (!snap.exists()) return null;
    const d = snap.data();
    const fee_type = String(d?.fee_type || '').trim();
    const fee_value = Number(d?.fee_value) || 0;
    if (!fee_type || fee_type === 'none' || fee_value <= 0) return null;
    if (fee_type !== 'percent_payer' && fee_type !== 'fixed_per_ticket') return null;
    return { fee_type: fee_type as OrganizerBuyerFeeDoc['fee_type'], fee_value };
  } catch (e) {
    console.error('Error fetching organizer buyer fee:', e);
    return null;
  }
};

/** Token de acceso del organizador en MP (marketplace / split). Solo super admin vía reglas. */
export const getOrganizerMpSellerConfigured = async (organizerId: string): Promise<boolean> => {
  try {
    const id = String(organizerId || '').trim();
    if (!id) return false;
    const ref = doc(db, 'organizer_mp_seller', id);
    const snap = await getDoc(ref);
    if (!snap.exists()) return false;
    const t = String(snap.data()?.access_token || '').trim();
    return t.length > 0;
  } catch (e) {
    console.error('Error fetching organizer_mp_seller:', e);
    return false;
  }
};

export const setOrganizerMpSellerAccessToken = async (
  organizerId: string,
  accessToken: string
): Promise<void> => {
  const id = String(organizerId || '').trim();
  const t = accessToken.trim();
  if (!id) throw new Error('Organizador inválido');
  if (!t) throw new Error('Pega el access token de producción del organizador');
  const ref = doc(db, 'organizer_mp_seller', id);
  await setDoc(
    ref,
    {
      access_token: t,
      updated_at: serverTimestamp(),
    },
    { merge: true }
  );
};

export const clearOrganizerMpSellerAccessToken = async (organizerId: string): Promise<void> => {
  const id = String(organizerId || '').trim();
  if (!id) throw new Error('Organizador inválido');
  await deleteDoc(doc(db, 'organizer_mp_seller', id)).catch(() => undefined);
};

export const setOrganizerBuyerFee = async (
  organizerId: string,
  payload: { fee_type: 'percent_payer' | 'fixed_per_ticket' | 'none'; fee_value: number }
): Promise<void> => {
  const id = String(organizerId || '').trim();
  if (!id) throw new Error('Organizador inválido');
  const ref = doc(db, 'organizer_buyer_fees', id);
  if (payload.fee_type === 'none' || payload.fee_value <= 0) {
    await deleteDoc(ref).catch(() => undefined);
    return;
  }
  await setDoc(
    ref,
    {
      fee_type: payload.fee_type,
      fee_value: payload.fee_value,
      updated_at: serverTimestamp(),
    },
    { merge: true }
  );
};

const DEFAULT_WHATSAPP_PHONE = '573016929622';

// Get contact configuration from Firestore
export const getContactConfig = async (): Promise<{ whatsappPhone: string }> => {
  try {
    const configDocRef = doc(db, 'configurations', 'contact_config');
    const configDoc = await getDoc(configDocRef);

    if (configDoc.exists()) {
      const data = configDoc.data();
      const phone = data?.whatsappPhone?.trim?.();
      if (phone) {
        return { whatsappPhone: phone.replace(/\D/g, '') };
      }
    }

    return { whatsappPhone: DEFAULT_WHATSAPP_PHONE };
  } catch (error) {
    console.error('Error fetching contact config:', error);
    return { whatsappPhone: DEFAULT_WHATSAPP_PHONE };
  }
};

// Update contact configuration in Firestore
export const updateContactConfig = async (data: { whatsappPhone: string }): Promise<void> => {
  const configDocRef = doc(db, 'configurations', 'contact_config');
  const phone = (data.whatsappPhone || '').trim().replace(/\D/g, '');
  if (!phone) {
    throw new Error('El número de WhatsApp no puede estar vacío.');
  }
  await setDoc(configDocRef, { whatsappPhone: phone }, { merge: true });
};

// Get home banners
export const getHomeBanners = async (): Promise<BannerItem[]> => {
  try {
    const configDocRef = doc(db, 'configurations', 'home_banners');
    const configDoc = await getDoc(configDocRef);
    if (configDoc.exists()) {
      const data = configDoc.data();
      const banners = data?.banners || [];
      return banners
        .filter((b: { url?: string }) => b?.url)
        .sort((a: { order?: number }, b: { order?: number }) => (a.order ?? 0) - (b.order ?? 0));
    }
    return [];
  } catch (error) {
    console.error('Error fetching banners:', error);
    return [];
  }
};

// Save home banners
export const saveHomeBanners = async (banners: BannerItem[]): Promise<void> => {
  const configDocRef = doc(db, 'configurations', 'home_banners');
  await setDoc(configDocRef, { banners }, { merge: true });
};

// Expense interface
export interface Expense {
  id: string;
  description: string;
  amount: number;
  date: string; // YYYY-MM-DD
  category?: string;
  eventId?: string; // Opcional: egreso asociado a un evento
  createdAt?: unknown;
}

// Get all expenses (exclude soft-deleted)
export const getExpenses = async (): Promise<Expense[]> => {
  try {
    const expensesRef = collection(db, 'expenses');
    const querySnapshot = await getDocs(expensesRef);
    return querySnapshot.docs
      .filter((docSnap) => !docSnap.data().deleted)
      .map((docSnap) => ({
        id: docSnap.id,
        ...docSnap.data()
      })) as Expense[];
  } catch (error) {
    console.error('Error fetching expenses:', error);
    return [];
  }
};

// Add expense (eventId opcional para egresos por evento)
export const addExpense = async (expense: Omit<Expense, 'id'> & { eventId?: string }): Promise<string> => {
  const expensesRef = collection(db, 'expenses');
  const docRef = await addDoc(expensesRef, {
    ...expense,
    createdAt: new Date()
  });
  return docRef.id;
};

// Get expenses by event ID
export const getExpensesByEventId = async (eventId: string): Promise<Expense[]> => {
  try {
    const expensesRef = collection(db, 'expenses');
    const q = query(expensesRef, where('eventId', '==', eventId));
    const querySnapshot = await getDocs(q);
    return querySnapshot.docs
      .filter((docSnap) => !docSnap.data().deleted)
      .map((docSnap) => ({
        id: docSnap.id,
        ...docSnap.data()
      })) as Expense[];
  } catch (error) {
    console.error('Error fetching expenses by event:', error);
    return [];
  }
};

// Delete expense (soft delete)
export const deleteExpense = async (expenseId: string): Promise<void> => {
  const expenseRef = doc(db, 'expenses', expenseId);
  await updateDoc(expenseRef, { deleted: true, deletedAt: new Date() });
};

// Get total revenue from tickets
export const getTotalRevenue = async (): Promise<number> => {
  try {
    const ticketsRef = collection(db, 'tickets');
    const snapshot = await getDocs(ticketsRef);
    let total = 0;
    snapshot.forEach((docSnap) => {
      const data = docSnap.data();
      const status = data.ticketStatus || data.status;
      if (
        (status === 'paid' || status === 'used' || status === 'redeemed' || status === 'approved') &&
        status !== 'cancelled' &&
        status !== 'disabled' &&
        !data.transferredTo
      ) {
        total += data.amount || data.purchaseAmount || 0;
      }
    });
    return total;
  } catch (error) {
    console.error('Error fetching revenue:', error);
    return 0;
  }
};

/**
 * Asigna un `slug` único en la colección indicada: `base`, luego `base_2`, `base_3`, …
 * @param excludeDocId — al editar, el documento actual no cuenta como colisión.
 */
export const allocateUniqueEventSlug = async (
  collectionName: 'events' | 'recurring_events',
  baseSlug: string,
  excludeDocId?: string
): Promise<string> => {
  const root = baseSlug.trim() || 'evento';
  let candidate = root;
  let n = 2;
  for (;;) {
    const q = query(collection(db, collectionName), where('slug', '==', candidate), limit(5));
    const snap = await getDocs(q);
    const conflicting = snap.docs.filter((d) => d.id !== excludeDocId);
    if (conflicting.length === 0) return candidate;
    candidate = `${root}_${n}`;
    n += 1;
  }
};

// Get all venues from Firestore
export const getVenues = async (): Promise<Venue[]> => {
  try {
    const venuesRef = collection(db, 'venues');
    const querySnapshot = await getDocs(venuesRef);
    const venues: Venue[] = [];
    
    querySnapshot.forEach((doc) => {
      venues.push({
        id: doc.id,
        ...doc.data()
      } as Venue);
    });
    
    return venues;
  } catch (error) {
    console.error('Error fetching venues:', error);
    return [];
  }
};

export { db }; 