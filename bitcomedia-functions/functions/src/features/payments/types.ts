import {Timestamp} from "firebase-admin/firestore";

// Interfaces principales
export interface CreateTicketRequest {
  userId: string;
  eventId: string;
  amount: number;
  quantity: number; // Cantidad de tickets/reservas
  buyerEmail: string;
  /** Reserva de 10 min (callable createTicketReservation) obligatoria para compra pública */
  reservationId: string;
  /** Compra sin cuenta: el backend genera userId guest_* */
  guestCheckout?: boolean;
  metadata?: {
    userName?: string;
    eventName?: string;
    seatNumber?: string;
    sectionId?: string;
  };
}

export interface Ticket {
  userId: string;
  eventId: string;
  preferenceId: string;
  paymentId: string;
  paymentStatus: PaymentStatus;
  paymentMethod: string;
  amount: number;
  quantity: number; // Cantidad de tickets/reservas
  currency: string;
  ticketStatus: TicketStatus;
  createdAt: Timestamp;
  updatedAt: Timestamp;
  qrCode: string;
  buyerEmail: string;
  initPoint: string; // URL de acceso al ticket o pago
  metadata: {
    userName: string;
    eventName: string;
    seatNumber: string;
  };
}

export interface PaymentData {
  id: string;
  status: PaymentStatus;
  payment_method_id?: string;
  external_reference?: string;
  [key: string]: any;
}

export interface PreferenceResponse {
  ticketId: string;
  preferenceId: string;
  initPoint: string;
  sandboxInitPoint?: string;
}

export interface WebhookNotification {
  // Formato Webhook estándar
  action?: string;
  api_version?: string;
  data?: {
    id: string;
  };
  date_created?: string;
  id?: number;
  live_mode?: boolean;
  type?: string;
  user_id?: string;

  // Formato IPN alternativo
  topic?: string;
  resource?: string;
}

export interface MerchantOrderData {
  id: string;
  status: string;
  external_reference?: string;
  payments: Array<{
    id: string;
    status: string;
    transaction_amount: number;
  }>;
}

// Enums
export type PaymentStatus =
  | "pending"
  | "approved"
  | "rejected"
  | "cancelled"
  | "refunded";

export type TicketStatus =
  | "reserved"
  | "paid"
  | "cancelled"
  | "expired"
  | "used";

// Interfaces de servicios
export interface PaymentService {
  createTicketPreference(
    request: CreateTicketRequest,
    userId: string
  ): Promise<PreferenceResponse>;

  processWebhookNotification(
    notification: WebhookNotification,
    headers: Record<string, string>
  ): Promise<void>;

  updateTicketFromPayment(
    ticketId: string,
    paymentData: PaymentData
  ): Promise<void>;
}

export interface TicketRepository {
  create(ticket: Omit<Ticket, "createdAt" | "updatedAt">): Promise<string>;
  findById(ticketId: string): Promise<Ticket | null>;
  update(ticketId: string, updates: Partial<Ticket>): Promise<void>;
  delete(ticketId: string): Promise<void>;
  findByPaymentId(paymentId: string): Promise<Ticket | null>;
  findByUserId(userId: string): Promise<Ticket[]>;
}

export interface PaymentProvider {
  createPreference(preferenceData: any): Promise<any>;
  getPayment(paymentId: string): Promise<PaymentData>;
  getMerchantOrder(orderId: string): Promise<MerchantOrderData>;
  validateWebhookSignature(
    signature: string,
    requestId: string,
    dataId: string,
    secret: string
  ): boolean;
}

export interface QRCodeGenerator {
  generateQRCode(ticketId: string, appUrl: string): Promise<string>;
}

// Configuración
export interface PaymentConfig {
  accessToken: string;
  webhookSecret: string;
  appUrl: string;
  isDevelopment: boolean;
  minAmount: number;
}
