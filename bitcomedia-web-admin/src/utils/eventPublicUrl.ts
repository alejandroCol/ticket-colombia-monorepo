import { getDefaultPublicTicketOrigin } from '../config/publicTicketApp';

/** URL absoluta a la ficha pública del evento en la app de compra (`/evento/:slug`). */
export function buildEventPublicPageUrl(slug: string): string {
  const base = getDefaultPublicTicketOrigin().replace(/\/+$/, '');
  const s = String(slug || '').trim();
  if (!s) return base;
  return `${base}/evento/${encodeURIComponent(s)}`;
}
