import type { Event, Ticket } from '@services/types';

/** Comisión estimada de la tiquetera (COP) según reglas del evento y boletos válidos */
export function computePlatformCommissionCOP(
  event: Pick<Event, 'platform_commission_type' | 'platform_commission_value'>,
  validTickets: Ticket[]
): number {
  const type = event.platform_commission_type;
  const value = Number(event.platform_commission_value) || 0;
  const revenue = validTickets.reduce((s, t) => s + (Number(t.amount) || 0), 0);
  const qty = validTickets.reduce((s, t) => s + (Number(t.quantity) || 1), 0);
  if (!type || value <= 0) return 0;
  if (type === 'fixed_per_ticket') return Math.round(value * qty);
  if (type === 'percent_payer') return Math.round(revenue * (value / 100));
  return 0;
}
