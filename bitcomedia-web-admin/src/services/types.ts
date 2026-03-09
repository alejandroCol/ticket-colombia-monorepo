import { Timestamp } from 'firebase/firestore';

/**
 * Shared types for services
 */

// User data interface
export interface UserData {
  uid: string;
  active?: boolean;
  city?: string;
  creation_date?: Timestamp | string;
  email: string;
  name?: string;
  phone?: string;
  profile_url?: string;
  role?: string;
  [key: string]: string | number | boolean | Timestamp | undefined | null;
}

// Venue interface
export interface Venue {
  id: string;
  name: string;
  address: string;
  city: string;
  description?: string;
}

// Event section (localidad) interface
export interface EventSection {
  id: string;
  name: string;
  available: number;
  price: number;
}

// Event interface
export interface Event {
  id: string;
  name: string;
  description: string;
  date: string;
  time: string;
  event_date: Timestamp | Date;
  city: string;
  venue?: {
    name: string;
    address: string;
  };
  cover_image_url: string;
  capacity_per_occurrence: number;
  ticket_price: number; // Precio por defecto (para compatibilidad con eventos antiguos)
  sections?: EventSection[]; // Nuevo: sistema de localidades
  event_type: string;
  status: string;
  creation_date: Timestamp | Date;
  organizer_id: string;
  recurring_event_id?: string;
  external_url?: string;
  [key: string]: string | number | boolean | Timestamp | Date | object | undefined;
}

// Ticket interface based on Firestore structure
export interface Ticket {
  id: string;
  amount: number;
  price?: number; // Precio del ticket (para tickets manuales)
  buyerEmail: string;
  createdAt: Timestamp;
  currency: string;
  eventId: string;
  metadata?: {
    eventName: string;
    seatNumber: string;
    userName: string;
  };
  paymentId?: string | number;
  paymentMethod: string;
  paymentStatus?: 'pending' | 'approved' | 'rejected';
  status?: 'pending' | 'approved' | 'rejected'; // Estado de pago (compatibilidad)
  preferenceId?: string;
  qrCode: string;
  quantity: number;
  ticketStatus: 'reserved' | 'paid' | 'cancelled' | 'used' | 'redeemed' | 'disabled';
  updatedAt?: Timestamp;
  userId?: string;
  // Campos para tickets manuales
  buyerName?: string;
  buyerPhone?: string;
  buyerIdNumber?: string; // Cédula del comprador
  sectionName?: string; // Nombre de la localidad/sección
  sectionId?: string; // ID de la localidad/sección
  createdByAdmin?: string;
  // Campos de validación
  validatedAt?: Timestamp | null;
  validatedBy?: string | null;
} 