import { getFirestore, doc, getDoc, setDoc, updateDoc, collection, query, where, getDocs, limit } from 'firebase/firestore';
import type { UserData, Event } from './types';
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

// Get event data from Firestore by ID
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

// Get event data from Firestore by slug
export const getEventBySlug = async (slug: string): Promise<Event | null> => {
  try {
    const eventsRef = collection(db, 'events');
    const q = query(eventsRef, where('slug', '==', slug), limit(1));
    const querySnapshot = await getDocs(q);
    
    if (!querySnapshot.empty) {
      const eventDoc = querySnapshot.docs[0];
      return { id: eventDoc.id, ...eventDoc.data() } as Event;
    }
    
    // If no event document exists with this slug, return null
    return null;
    
  } catch (error) {
    console.error('Error fetching event data by slug:', error);
    return null;
  }
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

export type OrganizerBuyerFeeDoc = {
  fee_type: 'percent_payer' | 'fixed_per_ticket';
  fee_value: number;
};

/** Tarifa por defecto al comprador para eventos de este organizador (si el evento no tiene override). */
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

const DEFAULT_WHATSAPP_PHONE = '573016929622';

// Get contact configuration from Firestore (WhatsApp number for landing/contact)
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

// Banner item for home carousel
export interface BannerItem {
  id?: string;
  url: string;
  order?: number;
}

// Get event labels (etiquetas) from configurations - used when event.event_labels is empty
export const getEventLabelsConfig = async (): Promise<string[]> => {
  try {
    const configDocRef = doc(db, 'configurations', 'event_labels');
    const configDoc = await getDoc(configDocRef);
    if (configDoc.exists()) {
      const data = configDoc.data();
      const labels = data?.labels;
      return Array.isArray(labels) ? labels.filter((l: unknown) => typeof l === 'string') : [];
    }
    return [];
  } catch {
    return [];
  }
};

// Get home banners from Firestore (configurations/home_banners)
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
    console.error('Error fetching home banners:', error);
    return [];
  }
};

export { db }; 