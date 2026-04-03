/** URL pública donde vive la app de compra (sin barra final). Configura VITE_PUBLIC_TICKET_APP_ORIGIN si difiere. */
export function getDefaultPublicTicketOrigin(): string {
  const raw = import.meta.env.VITE_PUBLIC_TICKET_APP_ORIGIN as string | undefined;
  const s = raw?.trim().replace(/\/+$/, '');
  if (s) return s;
  return 'https://ticketcolombia.co';
}
