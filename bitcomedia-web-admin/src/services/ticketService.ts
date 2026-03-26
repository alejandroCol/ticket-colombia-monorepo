import { getFunctions, httpsCallable } from 'firebase/functions';
import { getAuth } from 'firebase/auth';
import { collection, query, where, getDocs, orderBy, doc, getDoc, updateDoc, Timestamp } from 'firebase/firestore';
import { app } from './firebase';
import { db } from './firestore';
import { hasAdminAccess } from './auth';
import { partnerCanReadTicket, partnerCanValidateTicket } from './partnerGrants';
import type { Ticket } from './types';

// Initialize Firebase Functions
const functions = getFunctions(app);
const createTicketPreference = httpsCallable(functions, 'createTicketPreference');

export interface CreateReservationResult {
  reservationId: string;
  expiresAt: number;
  holdMinutes: number;
}

/** Reserva de cupo (misma callable que la app pública); el admin usa su uid autenticado. */
async function createTicketReservationForAdmin(params: {
  eventId: string;
  quantity: number;
  sectionId?: string;
  sectionName?: string;
}): Promise<CreateReservationResult> {
  const fn = httpsCallable<
    {
      eventId: string;
      quantity: number;
      sectionId?: string;
      sectionName?: string;
      holderSessionKey?: string;
    },
    CreateReservationResult
  >(functions, 'createTicketReservation');
  const payload: {
    eventId: string;
    quantity: number;
    sectionId?: string;
    sectionName?: string;
  } = {
    eventId: params.eventId,
    quantity: params.quantity,
  };
  if (params.sectionId?.trim()) payload.sectionId = params.sectionId.trim();
  if (params.sectionName?.trim()) payload.sectionName = params.sectionName.trim();
  const result = await fn(payload);
  return result.data;
}

// Ticket data interface
export interface TicketData {
  userId: string;
  eventId: string;
  amount: number;
  quantity: number;
  buyerEmail: string;
  /** Si ya tienes una reserva activa (poco habitual en admin) */
  reservationId?: string;
  metadata: {
    userName: string;
    eventName: string;
    eventDate: string;
    eventTime: string;
    venue: string;
    city: string;
    /** Nombre de localidad (debe coincidir con la reserva y con el evento) */
    seatNumber?: string;
    sectionId?: string;
  };
}

function chunkIds<T>(arr: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

export function ticketCreatedAtMs(t: Ticket): number {
  const c = t.createdAt as { toMillis?: () => number } | undefined;
  if (c && typeof c.toMillis === 'function') return c.toMillis();
  return 0;
}

/** Boletos válidos para métricas de ventas (misma lógica que EventStats) */
export function isTicketValidForSalesStats(t: Ticket): boolean {
  const status = t.ticketStatus as string;
  const invalid = ['cancelled', 'disabled'].includes(status) || (t as { transferredTo?: string }).transferredTo;
  const valid = ['paid', 'reserved', 'used', 'redeemed'].includes(status);
  return valid && !invalid;
}

/**
 * Tickets con createdAt >= since. Si eventIds es null o vacío (super admin), trae todos los que cumplan la fecha.
 */
export async function getTicketsSince(since: Date, eventIds: string[] | null): Promise<Ticket[]> {
  const sinceTs = Timestamp.fromDate(since);
  const ticketsRef = collection(db, 'tickets');
  const out: Ticket[] = [];

  if (!eventIds || eventIds.length === 0) {
    const q = query(ticketsRef, where('createdAt', '>=', sinceTs));
    const snap = await getDocs(q);
    snap.forEach((d) => out.push({ id: d.id, ...d.data() } as Ticket));
    return out;
  }

  for (const ids of chunkIds(eventIds, 10)) {
    const q = query(ticketsRef, where('eventId', 'in', ids), where('createdAt', '>=', sinceTs));
    const snap = await getDocs(q);
    snap.forEach((d) => out.push({ id: d.id, ...d.data() } as Ticket));
  }
  return out;
}

// Get tickets by event ID (Admin only - for stats dashboard)
export async function getTicketsByEventId(eventId: string): Promise<Ticket[]> {
  try {
    const ticketsRef = collection(db, 'tickets');
    const q = query(ticketsRef, where('eventId', '==', eventId));
    const querySnapshot = await getDocs(q);
    const tickets = querySnapshot.docs.map((docSnap) => ({
      id: docSnap.id,
      ...docSnap.data()
    })) as Ticket[];
    return tickets.sort((a, b) => {
      const aTime = a.createdAt && typeof a.createdAt === 'object' && 'toMillis' in a.createdAt
        ? (a.createdAt as { toMillis: () => number }).toMillis() : 0;
      const bTime = b.createdAt && typeof b.createdAt === 'object' && 'toMillis' in b.createdAt
        ? (b.createdAt as { toMillis: () => number }).toMillis() : 0;
      return bTime - aTime;
    });
  } catch (error) {
    console.error('Error fetching tickets by event:', error);
    throw error;
  }
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
      tickets.push({
        id: doc.id,
        ...doc.data()
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

// Get ticket by ID from Firestore (Users can access their own tickets, admins can access any)
export async function getTicketById(ticketId: string): Promise<Ticket | null> {
  try {
    const auth = getAuth();
    const user = auth.currentUser;
    
    if (!user) {
      throw new Error('Usuario debe estar autenticado');
    }
    
    const ticketRef = doc(db, 'tickets', ticketId);
    const ticketSnap = await getDoc(ticketRef);
    
    if (!ticketSnap.exists()) {
      return null;
    }
    
    const ticketData = ticketSnap.data() as Ticket;
    
    const isAdmin = await hasAdminAccess(user.uid);
    const isOwner = ticketData.userId === user.uid;
    const eventId = ticketData.eventId as string | undefined;
    const partnerRead =
      eventId && (await partnerCanReadTicket(user.uid, eventId));

    if (!isOwner && !isAdmin && !partnerRead) {
      throw new Error('No tienes permisos para acceder a este ticket');
    }
    
    return {
      ...ticketData,
      id: ticketSnap.id
    } as Ticket;
  } catch (error) {
    console.error('Error fetching ticket by ID:', error);
    throw error;
  }
}

// Validate ticket - Update status from 'paid' to 'redeemed' (Admin only)
export async function validateTicket(ticketId: string): Promise<void> {
  try {
    // Verify admin access
    const auth = getAuth();
    const user = auth.currentUser;
    
    if (!user) {
      throw new Error('Usuario debe estar autenticado');
    }
    
    const ticketRef = doc(db, 'tickets', ticketId);
    const ticketSnap = await getDoc(ticketRef);

    if (!ticketSnap.exists()) {
      throw new Error('Ticket no encontrado');
    }

    const ticketData = ticketSnap.data() as Ticket;
    const eventId = ticketData.eventId as string | undefined;
    const isAdmin = await hasAdminAccess(user.uid);
    const partnerScan = eventId && (await partnerCanValidateTicket(user.uid, eventId));
    if (!isAdmin && !partnerScan) {
      throw new Error('No tienes permiso para validar este boleto');
    }
    
    // Verificar si ya está validado
    if (ticketData.validatedAt) {
      throw new Error('Este ticket ya ha sido validado');
    }
    
    // Verificar que el ticket esté en un estado válido para validar
    if (ticketData.ticketStatus !== 'paid' && ticketData.status !== 'approved') {
      throw new Error('Solo se pueden validar tickets aprobados o pagados');
    }
    
    // Update the ticket status to 'used' and add validation info
    await updateDoc(ticketRef, {
      ticketStatus: 'used',
      status: 'approved', // Mantener status aprobado
      validatedAt: Timestamp.now(),
      validatedBy: user.uid,
      updatedAt: Timestamp.now()
    });
    
    console.log('Ticket validated successfully:', ticketId);
  } catch (error) {
    console.error('Error validating ticket:', error);
    throw error;
  }
}

// Create ticket preference for MercadoPago
export async function createTicket(ticketData: TicketData) {
  try {
    // Verificar que el usuario esté autenticado
    const auth = getAuth();
    const user = auth.currentUser;
    
    if (!user) {
      throw new Error('Usuario debe estar autenticado');
    }

    let reservationId = ticketData.reservationId?.trim();
    if (!reservationId) {
      const res = await createTicketReservationForAdmin({
        eventId: ticketData.eventId,
        quantity: ticketData.quantity,
        sectionId: ticketData.metadata.sectionId,
        sectionName: ticketData.metadata.seatNumber,
      });
      reservationId = res.reservationId;
    }

    // Asegurar que el userId coincida con el usuario autenticado
    const finalTicketData = {
      ...ticketData,
      userId: user.uid,
      reservationId,
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