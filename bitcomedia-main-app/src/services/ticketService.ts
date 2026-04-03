import { getFunctions, httpsCallable } from 'firebase/functions';
import { getAuth } from 'firebase/auth';
import { collection, query, where, getDocs, orderBy } from 'firebase/firestore';
import { app } from './firebase';
import { db } from './firestore';
import type { Ticket } from './types';

// Initialize Firebase Functions
const functions = getFunctions(app);
const createTicketPreference = httpsCallable(functions, 'createTicketPreference');
const getAbonoCheckoutPublicInfoFn = httpsCallable<
  { token: string },
  {
    ticketId: string;
    eventName: string;
    balanceCOP: number;
    depositCOP: number;
    totalCOP: number;
    balanceDueAtMs: number | null;
    phase: string;
  }
>(functions, 'getAbonoCheckoutPublicInfo');
const createBalanceInstallmentPreferenceFn = httpsCallable<
  { ticketId: string },
  { ticketId: string; preferenceId: string; initPoint: string; sandboxInitPoint?: string }
>(functions, 'createBalanceInstallmentPreference');

// Ticket data interface
export interface TicketData {
  userId: string;
  eventId: string;
  amount: number;
  quantity: number;
  buyerEmail: string;
  reservationId: string;
  guestCheckout?: boolean;
  /** full (default) o deposit (abono; requiere sesión y localidad con abono). */
  paymentMode?: 'full' | 'deposit';
  metadata: {
    userName: string;
    eventName: string;
    eventDate: string;
    eventTime: string;
    venue: string;
    city: string;
    seatNumber?: string;
    sectionId?: string;
    mapZoneId?: string;
    mapZoneLabel?: string;
    buyerIdNumber?: string;
  };
}

// Get user tickets from Firestore
export async function getUserTickets(userId: string): Promise<Ticket[]> {
  try {
    const ticketsRef = collection(db, 'tickets');
    const q = query(
      ticketsRef,
      where('userId', '==', userId),
      orderBy('createdAt', 'desc')
    );
    
    const querySnapshot = await getDocs(q);
    const tickets: Ticket[] = [];
    
    querySnapshot.forEach((doc) => {
      const d = doc.data();
      if (d.ticketKind === 'purchase_bundle_parent') return;
      tickets.push({
        id: doc.id,
        ...d
      } as Ticket);
    });
    
    return tickets;
  } catch (error) {
    console.error('Error fetching user tickets:', error);
    throw error;
  }
}

// Get current user tickets
export async function getCurrentUserTickets(): Promise<Ticket[]> {
  try {
    const auth = getAuth();
    const user = auth.currentUser;
    
    if (!user) {
      throw new Error('Usuario debe estar autenticado');
    }
    
    return await getUserTickets(user.uid);
  } catch (error) {
    console.error('Error fetching current user tickets:', error);
    throw error;
  }
}

// Transfer ticket to another person
export async function transferTicket(
  ticketId: string,
  recipientEmail: string,
  recipientName?: string
): Promise<{ success: boolean; message: string; newTicketId?: string }> {
  const functions = getFunctions(app);
  const transferTicketFn = httpsCallable<
    { ticketId: string; recipientEmail: string; recipientName?: string },
    { success: boolean; message: string; newTicketId?: string }
  >(functions, 'transferTicket');
  const result = await transferTicketFn({ ticketId, recipientEmail, recipientName });
  return result.data;
}

export async function getAbonoCheckoutPublicInfo(token: string) {
  const result = await getAbonoCheckoutPublicInfoFn({ token });
  return result.data;
}

export async function createBalanceInstallmentPreference(ticketId: string) {
  const result = await createBalanceInstallmentPreferenceFn({ ticketId });
  return result.data;
}

// Create ticket preference for MercadoPago (con cuenta o invitado)
export async function createTicket(ticketData: TicketData) {
  try {
    const auth = getAuth();
    const user = auth.currentUser;

    const finalTicketData =
      ticketData.guestCheckout || !user
        ? {
            ...ticketData,
            userId: ticketData.userId || 'pending',
            guestCheckout: true as const,
          }
        : {
            ...ticketData,
            userId: user.uid,
            guestCheckout: false,
          };

    console.log('Creando ticket con datos:', finalTicketData);

    const result = await createTicketPreference(finalTicketData);
    console.log('Preferencia creada:', result.data);

    return result.data;
  } catch (error) {
    console.error('Error creando ticket:', error);
    throw error;
  }
} 