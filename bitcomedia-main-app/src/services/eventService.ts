import { getFunctions, httpsCallable } from 'firebase/functions';
import { getAuth } from 'firebase/auth';
import { app } from './firebase';

const functions = getFunctions(app);

export const GUEST_HOLDER_SESSION_KEY = 'tc_holder_session';

export function getOrCreateGuestHolderSessionKey(): string {
  try {
    let v = sessionStorage.getItem(GUEST_HOLDER_SESSION_KEY);
    if (!v) {
      v = crypto.randomUUID();
      sessionStorage.setItem(GUEST_HOLDER_SESSION_KEY, v);
    }
    return v;
  } catch {
    return `tc_guest_${Date.now()}_${Math.random().toString(36).slice(2)}`;
  }
}

export interface AvailabilityResponse {
  bySection: Record<string, number>;
  byMapZone: Record<string, number>;
  totalSold: number;
  generalSold: number;
}

export async function getEventAvailability(
  eventIdOrSlug: string | { slug: string }
): Promise<AvailabilityResponse> {
  const fn = httpsCallable<
    { eventId?: string; slug?: string },
    AvailabilityResponse
  >(functions, 'getEventAvailability');
  const payload =
    typeof eventIdOrSlug === 'string'
      ? { eventId: eventIdOrSlug }
      : { slug: eventIdOrSlug.slug };
  const result = await fn(payload);
  return result.data;
}

export interface CreateReservationResult {
  reservationId: string;
  expiresAt: number;
  holdMinutes: number;
}

/** Reserva de cupo ~10 min (requerida antes de createTicketPreference). */
export async function createTicketReservation(params: {
  eventId: string;
  quantity: number;
  sectionId?: string;
  sectionName?: string;
  mapZoneId?: string;
}): Promise<CreateReservationResult> {
  const auth = getAuth();
  const user = auth.currentUser;

  const payload: {
    eventId: string;
    quantity: number;
    sectionId?: string;
    sectionName?: string;
    mapZoneId?: string;
    holderSessionKey?: string;
  } = {
    eventId: params.eventId,
    quantity: params.quantity,
  };
  if (params.sectionId) payload.sectionId = params.sectionId;
  if (params.sectionName) payload.sectionName = params.sectionName;
  if (params.mapZoneId?.trim()) payload.mapZoneId = params.mapZoneId.trim();
  if (!user) {
    payload.holderSessionKey = getOrCreateGuestHolderSessionKey();
  }

  const fn = httpsCallable<typeof payload, CreateReservationResult>(
    functions,
    'createTicketReservation'
  );
  const result = await fn(payload);
  return result.data;
}

export async function releaseTicketReservation(params: {
  reservationId: string;
}): Promise<{ released: boolean }> {
  const payload: { reservationId: string; holderSessionKey?: string } = {
    reservationId: params.reservationId,
  };
  try {
    const gk = sessionStorage.getItem(GUEST_HOLDER_SESSION_KEY);
    if (gk) payload.holderSessionKey = gk;
  } catch {
    /* ignore */
  }
  if (!payload.holderSessionKey) {
    const auth = getAuth();
    if (!auth.currentUser) {
      payload.holderSessionKey = getOrCreateGuestHolderSessionKey();
    }
  }

  const fn = httpsCallable<typeof payload, { released: boolean }>(
    functions,
    'releaseTicketReservation'
  );
  const result = await fn(payload);
  return result.data;
}
