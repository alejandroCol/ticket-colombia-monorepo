import {Timestamp} from "firebase-admin/firestore";
import type {OnePayWebhookPayload} from "./handlers/onepay.api";

// Interfaces principales
/** full: un solo pago. deposit: abono (requiere cuenta); el saldo se paga después. */
export type PaymentMode = "full" | "deposit";

export interface CreateTicketRequest {
  userId: string;
  eventId: string;
  amount: number;
  quantity: number; // Cantidad de unidades de localidad (palcos o entradas)
  buyerEmail: string;
  /** Reserva de 10 min (callable createTicketReservation) obligatoria para compra pública */
  reservationId: string;
  /** Compra sin cuenta: el backend genera userId guest_* */
  guestCheckout?: boolean;
  /** Por defecto full. deposit solo con login y localidad con abono_allowed. */
  paymentMode?: PaymentMode;
  metadata?: {
    userName?: string;
    eventName?: string;
    /** Nombre de la localidad (debe coincidir con la reserva). */
    seatNumber?: string;
    sectionId?: string;
    /** id de `venue_map.zones` cuando hay palcos divididos */
    mapZoneId?: string;
    /** Etiqueta en mapa (ej. "1", "2") */
    mapZoneLabel?: string;
    /** Cédula u otro documento del comprador (opcional); se guarda y muestra en PDF. */
    buyerIdNumber?: string;
    /** Teléfono del comprador (ej. E.164); invitados lo envían desde checkout. */
    buyerPhone?: string;
  };
}

export type TicketKind =
  | "standard"
  | "purchase_bundle_parent"
  | "purchase_pass";

export type InstallmentPhase =
  | "none"
  | "awaiting_deposit"
  | "deposit_paid"
  | "awaiting_balance"
  | "completed"
  | "forfeited";

export interface Ticket {
  userId: string;
  eventId: string;
  preferenceId: string;
  paymentId: string;
  paymentStatus: PaymentStatus;
  paymentMethod: string;
  amount: number;
  quantity: number; // Unidades de inventario (palcos o entradas)
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
    buyerIdNumber?: string;
    buyerPhone?: string;
  };
  /** Set when Checkout Pro se creó con token del organizador y split marketplace */
  mpSplitOrganizerId?: string;
  /** Monto COP de marketplace_fee enviado a MP (comisión tiquetera en el split) */
  mpMarketplaceFeeCOP?: number;
  /** Asientos por unidad (palco de 10 → 10). Default 1. */
  seatsPerUnit?: number;
  ticketKind?: TicketKind;
  childTicketIds?: string[];
  bundleParentTicketId?: string;
  passIndex?: number;
  passCount?: number;
  sectionId?: string;
  sectionName?: string;
  mapZoneId?: string;
  /** Cupo por evento (denormalizado para agregaciones rápidas en getEventAvailability). */
  capacityBucket?: string;
  capacityCount?: number;
  transferredTo?: string | null;
  transferredFrom?: string | null;
  /** Plan de abono (solo documento padre de la compra) */
  installmentPhase?: InstallmentPhase;
  totalPurchaseCOP?: number;
  depositCOP?: number;
  balanceCOP?: number;
  balanceDueAt?: Timestamp;
  abonoCompletionToken?: string;
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
  /** Opcional: flujo Brick (API de Pagos) si el backend lo devolviera */
  mpFlow?: "payments_api";
  publicKey?: string;
  amountCOP?: number;
  applicationFeeCOP?: number;
  payerEmail?: string;
  paymentDescription?: string;
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
export interface MercadoPagoCardPaymentRequest {
  ticketId: string;
  token: string;
  paymentMethodId: string;
  issuerId?: string;
  installments?: number;
  /** Compra invitado: mismo email que en el checkout (sin Firebase Auth). */
  guestEmail?: string;
}

export interface PaymentService {
  createTicketPreference(
    request: CreateTicketRequest,
    userId: string
  ): Promise<PreferenceResponse>;

  /** Segundo cobro del plan de abono (usuario autenticado dueño del ticket). */
  createBalanceInstallmentPreference(
    ticketId: string,
    userId: string
  ): Promise<PreferenceResponse>;

  /** API de Pagos: cobro con token de tarjeta (Brick). */
  createMercadoPagoCardPayment(
    request: MercadoPagoCardPaymentRequest,
    userId: string | undefined,
    guestEmail?: string
  ): Promise<{
    status: string;
    paymentId?: string;
    statusDetail?: string;
  }>;

  processWebhookNotification(
    notification: WebhookNotification,
    headers: Record<string, string>
  ): Promise<void>;

  updateTicketFromPayment(
    ticketId: string,
    paymentData: PaymentData
  ): Promise<void>;

  processOnePayWebhook(
    payload: OnePayWebhookPayload,
    rawBody: string,
    headers: Record<string, string>,
    parsedBodyForSignature?: unknown
  ): Promise<void>;
}

export interface TicketRepository {
  create(ticket: Omit<Ticket, "createdAt" | "updatedAt">): Promise<string>;
  findById(ticketId: string): Promise<Ticket | null>;
  update(ticketId: string, updates: Partial<Ticket>): Promise<void>;
  delete(ticketId: string): Promise<void>;
  findByPaymentId(paymentId: string): Promise<Ticket | null>;
  /** id del documento Firestore cuando `preferenceId` es el de Mercado Pago */
  findDocIdByPreferenceId(preferenceId: string): Promise<string | null>;
  findByUserId(userId: string): Promise<Ticket[]>;
  findIdByAbonoToken(token: string): Promise<string | null>;
}

export interface PaymentProvider {
  createPreference(preferenceData: any): Promise<any>;
  createPayment(body: Record<string, unknown>): Promise<unknown>;
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
  /** Public key de producción de la aplicación (cuando no hay vendedor OAuth). */
  mercadopagoPublicKey?: string;
  /** API key OnePay (Bearer) cuando `payment_provider` es onepay */
  onepayApiKey?: string;
  /** Secreto HMAC de webhooks OnePay (wh_tok_...) */
  onepayWebhookSecret?: string;
  /** Opcional: mismo valor que en panel OnePay `x-webhook-token` */
  onepayWebhookToken?: string;
  /** Opcional: envío de correo de abono tras webhook */
  resend?: {
    apiKey: string;
    senderEmail: string;
    senderName: string;
  };
}
