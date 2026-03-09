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

// Event interface
export interface Event {
  id: string;
  slug?: string;
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
  ticket_price: number;
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
  buyerEmail: string;
  createdAt: Timestamp;
  currency: string;
  eventId: string;
  metadata: {
    eventName: string;
    seatNumber: string;
    userName: string;
  };
  paymentId: string | number;
  paymentMethod: string;
  paymentStatus: 'pending' | 'approved' | 'rejected';
  preferenceId: string;
  qrCode: string;
  quantity: number;
  ticketStatus: 'reserved' | 'paid' | 'cancelled' | 'used' | 'redeemed';
  updatedAt: Timestamp;
  userId: string;
} 