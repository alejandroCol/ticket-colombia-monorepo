import type { VenueMapConfig } from '@services/types';
import { mapZoneDisplayLabel } from './venueMapSection';

export type TicketLocalityFields = {
  sectionName?: string;
  sectionId?: string;
  mapZoneId?: string;
  metadata?: {
    seatNumber?: string;
    mapZoneLabel?: string;
    userName?: string;
    buyerIdNumber?: string;
    buyerPhone?: string;
  };
};

export type ResolvedTicketLocality = {
  /** Nombre de localidad sin número de palco */
  sectionName: string;
  /** Etiqueta del palco (ej. "3", "VIP A") o null */
  palcoLabel: string | null;
  /** Clave para filtro de palcos (ej. "Palco 3") */
  palcoFilterKey: string | null;
  /** Texto combinado para la columna Localidad */
  displayLine: string;
};

function palcoFromSectionName(sectionName: string): { section: string; palco: string | null } {
  if (!sectionName.includes('·')) {
    return { section: sectionName, palco: null };
  }
  const parts = sectionName.split('·').map((s) => s.trim());
  const section = parts[0] || sectionName;
  const tail = parts[parts.length - 1] || '';
  const palcoMatch = tail.match(/palco\s*(.+)/i);
  if (palcoMatch) return { section, palco: palcoMatch[1].trim() };
  if (/^\d+$/.test(tail)) return { section, palco: tail };
  return { section: sectionName, palco: null };
}

function palcoFromSeatNumber(seatNumber: string, sectionName: string): string | null {
  const seat = seatNumber.trim();
  if (!seat || seat === sectionName) return null;
  const suffix = seat.startsWith(sectionName)
    ? seat.slice(sectionName.length).trim()
    : seat;
  if (!suffix) return null;
  const num = suffix.match(/^(\d+)$/);
  if (num) return num[1];
  const palcoMatch = suffix.match(/palco\s*(.+)/i);
  if (palcoMatch) return palcoMatch[1].trim();
  return suffix;
}

/**
 * Resuelve localidad y palco de un ticket usando el mapa del evento como fuente de verdad.
 */
export function resolveTicketLocality(
  ticket: TicketLocalityFields,
  venueMap?: VenueMapConfig | null
): ResolvedTicketLocality {
  const rawSection = (ticket.sectionName || ticket.metadata?.seatNumber || 'General').trim();
  const parsed = palcoFromSectionName(rawSection);
  let sectionName = parsed.section || 'General';
  let palcoLabel: string | null = parsed.palco;

  if (ticket.mapZoneId && venueMap?.zones?.length) {
    const zone = venueMap.zones.find((z) => z.id === ticket.mapZoneId);
    if (zone) {
      palcoLabel = mapZoneDisplayLabel(zone);
      if (zone.sectionId && venueMap.zones.length > 0) {
        const sameSection = venueMap.zones.filter((z) => z.sectionId === zone.sectionId);
        if (sameSection.some((z) => z.palco_index != null) && ticket.sectionName?.trim()) {
          sectionName = ticket.sectionName.trim();
          if (sectionName.includes('·')) {
            sectionName = palcoFromSectionName(sectionName).section;
          }
        }
      }
    }
  }

  const metaLabel = String(ticket.metadata?.mapZoneLabel || '').trim();
  if (!palcoLabel && metaLabel) palcoLabel = metaLabel;

  if (!palcoLabel && ticket.metadata?.seatNumber) {
    palcoLabel = palcoFromSeatNumber(ticket.metadata.seatNumber, sectionName);
  }

  const displayLine = palcoLabel ? `${sectionName} · Palco ${palcoLabel}` : sectionName;
  const palcoFilterKey = palcoLabel ? `Palco ${palcoLabel}` : null;

  return { sectionName, palcoLabel, palcoFilterKey, displayLine };
}

/** Fases de abono visibles en el panel de abonados del admin. */
export const ABONO_PENDING_PHASES = [
  'awaiting_deposit',
  'deposit_paid',
  'awaiting_balance',
] as const;

export type AbonoPendingPhase = (typeof ABONO_PENDING_PHASES)[number];

export type TicketAbonoFields = {
  installmentPhase?: string | null;
  depositCOP?: number | null;
  balanceCOP?: number | null;
  totalPurchaseCOP?: number | null;
  abonoCompletionToken?: string | null;
};

/** Ticket creado con plan de abono (tiene campos de cuotas aunque falte installmentPhase). */
export function ticketHasAbonoPlan(t: TicketAbonoFields): boolean {
  const phase = t.installmentPhase || 'none';
  if ((ABONO_PENDING_PHASES as readonly string[]).includes(phase)) return true;
  if (phase === 'completed') return true;
  if (String(t.abonoCompletionToken || '').trim()) return true;
  const deposit = Number(t.depositCOP) || 0;
  const balance = Number(t.balanceCOP) || 0;
  const total = Number(t.totalPurchaseCOP) || 0;
  return deposit > 0 || balance > 0 || (total > 0 && deposit > 0);
}

/** Abono con pago pendiente (sin QR emitido aún). */
export function isTicketAbonoRow(t: TicketAbonoFields): boolean {
  const phase = t.installmentPhase || 'none';
  if ((ABONO_PENDING_PHASES as readonly string[]).includes(phase)) return true;
  if (phase === 'completed' || phase === 'forfeited') return false;
  return ticketHasAbonoPlan(t);
}

/** Abono ya completado (pagó depósito + saldo). Aparece en el listado principal con badge. */
export function isTicketAbonoCompleted(t: TicketAbonoFields & { ticketStatus?: string | null }): boolean {
  const phase = t.installmentPhase || 'none';
  if (phase === 'completed') return true;
  const deposit = Number(t.depositCOP) || 0;
  const balance = Number(t.balanceCOP) || 0;
  const paid = t.ticketStatus === 'paid' || t.ticketStatus === 'used' || t.ticketStatus === 'redeemed';
  return paid && deposit > 0 && balance >= 0 && String(t.abonoCompletionToken || '').trim() !== '';
}

/** Reserva de checkout a pago total (sin plan de abono). */
export function isTicketCheckoutHold(t: {
  ticketStatus?: string | null;
  installmentPhase?: string | null;
  depositCOP?: number | null;
  balanceCOP?: number | null;
  totalPurchaseCOP?: number | null;
  abonoCompletionToken?: string | null;
}): boolean {
  if (t.ticketStatus !== 'reserved') return false;
  return !isTicketAbonoRow(t);
}

/** El evento tiene abono habilitado en al menos una localidad o reglas globales. */
export function eventSupportsAbono(event?: {
  abono_min_percent?: number;
  abono_min_amount_cop?: number;
  sections?: Array<{ abono_allowed?: boolean }>;
} | null): boolean {
  if (!event) return false;
  if (Number(event.abono_min_percent) > 0 || Number(event.abono_min_amount_cop) > 0) return true;
  return (event.sections || []).some((s) => s.abono_allowed === true);
}
