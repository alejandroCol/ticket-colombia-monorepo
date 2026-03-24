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

// Get payment configuration from Firestore
export const getPaymentConfig = async (): Promise<{ fees: number; taxes: number } | null> => {
  try {
    const configDocRef = doc(db, 'configurations', 'payments_config');
    const configDoc = await getDoc(configDocRef);
    
    if (configDoc.exists()) {
      const data = configDoc.data();
      return {
        fees: data.fees || 0,
        taxes: data.taxes || 0
      };
    }
    
    // If no config document exists, return default values
    return {
      fees: 9, // 9% de comisión sobre el subtotal
      taxes: 19
    };
    
  } catch (error) {
    console.error('Error fetching payment config:', error);
    // Return default values on error
    return {
      fees: 9, // 9% de comisión sobre el subtotal
      taxes: 19
    };
  }
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