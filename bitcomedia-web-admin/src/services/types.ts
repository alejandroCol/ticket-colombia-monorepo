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
  /** Puestos por unidad (ej. palco de 10 → 10 QRs por cada palco vendido). Por defecto 1. */
  seats_per_unit?: number;
  /** Si la compra con abono (solo usuarios con sesión) está permitida en esta localidad. */
  abono_allowed?: boolean;
  /**
   * Palcos divididos multipersona: `price` es el total del palco (incluye N personas); una venta genera N QR.
   */
  palco_multipersona?: boolean;
}

/** Forma de la zona de localidad en el mapa (por defecto rectángulo). */
export type VenueMapZoneShape = 'rect' | 'circle';

/** Zona clickeable en el mapa (coordenadas en % 0–100) */
export interface VenueMapZone {
  id: string;
  label: string;
  sectionId: string;
  x: number;
  y: number;
  w: number;
  h: number;
  /** Circular: `border-radius: 50%` sobre el rectángulo w×h (cuadrado ≈ círculo perfecto). */
  shape?: VenueMapZoneShape;
  /** Color de la zona en el mapa (hex #rrggbb). Vacío = estilo por defecto. */
  color?: string;
  /** Tras «Dividir en palcos»: número mostrado en mapa (1, 2, …). */
  palco_index?: number;
}

/** Elementos decorativos del mapa (no clicables; % 0–100) */
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

/** Proporción del marco del mapa en la tienda y en el editor. */
export type VenueMapFrameAspect = 'landscape' | 'portrait';

export interface VenueMapVisualConfig {
  background: string;
  /** Imagen de fondo del plano (Storage), muy comprimida al subir. */
  backgroundImageUrl?: string;
  /** Mapa aplanado exportado como PNG (opcional). Si existe, la app puede mostrarlo como imagen única. */
  flatRenderUrl?: string;
  decorations: VenueMapDecoration[];
  /**
   * Formato del mapa público: horizontal 16∶9 (default) o vertical 4∶5 (tipo flyer / boletería).
   * Afecta lienzo en admin, export PNG y vista en la app.
   */
  frame_aspect?: VenueMapFrameAspect;
  /**
   * Si true, en el mapa de la tienda no se muestra texto dentro de los recuadros de localidad/palco
   * (solo el área coloreada; titulos y accesibilidad siguen en aria-label).
   */
  hide_public_zone_labels?: boolean;
}

export interface VenueMapConfig {
  zones?: VenueMapZone[];
  visual?: VenueMapVisualConfig;
}

/** Zona guardada en una plantilla (sin sectionId; precio/cupo sugeridos al aplicar). */
export interface VenueMapTemplateZoneLayout {
  label: string;
  x: number;
  y: number;
  w: number;
  h: number;
  shape?: VenueMapZoneShape;
  defaultPrice?: number;
  defaultAvailable?: number;
  color?: string;
}

/** Documento en Firestore `venue_map_templates` */
export interface VenueMapTemplateDocument {
  id: string;
  name: string;
  organizer_id: string;
  visual: VenueMapVisualConfig;
  zone_layouts: VenueMapTemplateZoneLayout[];
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
  /** PDF de entradas por correo: `standard` (clásico) o `minimal_center` (QR centrado, sin titular). */
  ticket_flyer_pdf_layout?: 'standard' | 'minimal_center';
  /** Color #RRGGBB para textos destacados del PDF del boleto (default azul #00d4ff). */
  ticket_flyer_accent_color?: string;
  /** Opción 2 PDF: color del nombre del comprador en el recuadro. */
  ticket_flyer_minimal_name_color?: string;
  /** Opción 2 PDF: color del correo e indicaciones bajo el recuadro. */
  ticket_flyer_minimal_email_color?: string;
  capacity_per_occurrence: number;
  ticket_price: number; // Precio por defecto (para compatibilidad con eventos antiguos)
  sections?: EventSection[]; // Nuevo: sistema de localidades
  event_type: string;
  status: string;
  creation_date: Timestamp | Date;
  organizer_id: string;
  recurring_event_id?: string;
  external_url?: string;
  venue_map?: VenueMapConfig;
  /** Tarifa de servicio al comprador (solo super admin en el evento); prevalece sobre tarifa del organizador y la global */
  platform_commission_type?: 'percent_payer' | 'fixed_per_ticket' | '' | string;
  /** Porcentaje (0–100) o COP fijos por entrada según platform_commission_type */
  platform_commission_value?: number;
  /** Reglas de abono para este evento (formulario del evento). */
  abono_min_percent?: number;
  abono_min_amount_cop?: number;
  abono_max_days_before_event?: number;
  /** WhatsApp de soporte (solo dígitos, con código de país). Obligatorio al crear/editar en el panel. */
  support_whatsapp?: string;
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