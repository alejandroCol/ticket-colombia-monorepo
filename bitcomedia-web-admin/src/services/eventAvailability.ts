import { httpsCallable } from 'firebase/functions';
import { functions } from './firebase';

/** Misma respuesta que `getEventAvailability` en Cloud Functions */
export interface EventAvailabilityPayload {
  bySection: Record<string, number>;
  byMapZone: Record<string, number>;
  totalSold: number;
  generalSold: number;
}

/** Cupo consumido por sección / celda del mapa (tickets válidos + reservas activas). */
export async function getEventAvailability(eventId: string): Promise<EventAvailabilityPayload> {
  const fn = httpsCallable<
    { eventId?: string; slug?: string },
    EventAvailabilityPayload
  >(functions, 'getEventAvailability');
  const trimmed = eventId.trim();
  if (!trimmed) throw new Error('eventId requerido');
  const result = await fn({ eventId: trimmed });
  return result.data;
}
