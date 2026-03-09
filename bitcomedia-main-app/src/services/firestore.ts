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

export { db }; 