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
  /** Cédula u otro documento (si está en el perfil / Firestore). */
  document?: string;
  name?: string;
  phone?: string;
  profile_url?: string;
  role?: string;
  [key: string]: string | number | boolean | Timestamp | undefined | null;
}

// Event section (localidad)
export interface EventSection {
  id: string;
  name: string;
  available: number;
  price: number;
  seats_per_unit?: number;
  abono_allowed?: boolean;
  /**
   * Palco multipersona (p. ej. celdas del mapa): `price` es el total del palco en COP (incluye las N personas);
   * la compra genera N códigos.
   */
  palco_multipersona?: boolean;
}

export type VenueMapZoneShape = 'rect' | 'circle';

/** Zona clickeable sobre el mapa (% respecto a la imagen) */
export interface VenueMapZone {
  id: string;
  label: string;
  sectionId: string;
  x: number;
  y: number;
  w: number;
  h: number;
  shape?: VenueMapZoneShape;
  /** Color de la zona en el mapa (hex #rrggbb). */
  color?: string;
  palco_index?: number;
}

export type VenueMapDecorationType =
  | 'stage'
  | 'palco_tier'
  | 'dance_floor'
  | 'bar_counter'
  | 'dj_booth'
  | 'theater_fan'
  | 'vip_box'
  | 'lounge_sofa'
  | 'high_table'
  | 'entrance_arch'
  | 'stairs'
  | 'balcony'
  | 'pillar'
  | 'light_rig'
  | 'pool_ring';

export interface VenueMapDecoration {
  id: string;
  type: VenueMapDecorationType;
  x: number;
  y: number;
  w: number;
  h: number;
  rotation: number;
  label?: string;
  color?: string;
  zIndex?: number;
}

export type VenueMapFrameAspect = 'landscape' | 'portrait';

export interface VenueMapVisualConfig {
  background: string;
  backgroundImageUrl?: string;
  flatRenderUrl?: string;
  decorations: VenueMapDecoration[];
  frame_aspect?: VenueMapFrameAspect;
  hide_public_zone_labels?: boolean;
}

export interface VenueMapConfig {
  zones?: VenueMapZone[];
  visual?: VenueMapVisualConfig;
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
  ticket_flyer_pdf_layout?: 'standard' | 'minimal_center';
  ticket_flyer_accent_color?: string;
  ticket_flyer_minimal_name_color?: string;
  ticket_flyer_minimal_email_color?: string;
  capacity_per_occurrence: number;
  ticket_price: number;
  sections?: EventSection[];
  event_type: string;
  status: string;
  creation_date: Timestamp | Date;
  organizer_id: string;
  recurring_event_id?: string;
  external_url?: string;
  event_labels?: string[];
  venue_map_url?: string;
  /** Zonas clickeables (requiere venue_map_url y sections) */
  venue_map?: VenueMapConfig;
  /** Tarifa de servicio al comprador (override super admin en el evento; si no, ver organizer_buyer_fees / global) */
  platform_commission_type?: string;
  platform_commission_value?: number;
  /** Reglas de abono (configura el admin del evento en el formulario). */
  abono_min_percent?: number;
  abono_min_amount_cop?: number;
  abono_max_days_before_event?: number;
  /** Soporte WhatsApp del organizador (dígitos, código de país). Debe existir para nuevos eventos desde el panel. */
  support_whatsapp?: string;
  /** Pasarela de checkout (sin valor → OnePay). */
  payment_provider?: 'onepay' | 'mercadopago';
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
    buyerIdNumber?: string;
  };
  paymentId: string | number;
  paymentMethod: string;
  paymentStatus: 'pending' | 'approved' | 'rejected';
  preferenceId: string;
  qrCode: string;
  quantity: number;
  ticketStatus: 'reserved' | 'paid' | 'cancelled' | 'used' | 'redeemed' | 'disabled';
  transferredTo?: string;
  updatedAt: Timestamp;
  userId: string;
  ticketKind?: string;
  installmentPhase?: string;
  abonoCompletionToken?: string;
  balanceCOP?: number;
} 