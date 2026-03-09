import { getFirestore, doc, getDoc, setDoc, updateDoc, collection, getDocs } from 'firebase/firestore';
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

// Get event data from Firestore
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