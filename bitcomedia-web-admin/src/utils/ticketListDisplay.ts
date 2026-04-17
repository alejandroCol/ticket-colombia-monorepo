/**
 * Normaliza datos de documentos `tickets` para listados admin: compras web usan
 * `amount` + `metadata.userName`, boletos manuales usan `price` + `buyerName` en raíz.
 */

export type TicketListDoc = {
  ticketKind?: string;
  isCourtesy?: boolean;
  isGeneralCourtesy?: boolean;
  price?: number;
  amount?: number;
  buyerName?: string;
  buyerIdNumber?: string;
  metadata?: { userName?: string; buyerIdNumber?: string; buyerPhone?: string };
  buyerPhone?: string;
};

/** COP cobrado en este documento (total de la línea). Prioriza `amount` (total) sobre `price` (puede ser unitario en bundles). */
export function ticketLineAmountCOP(t: TicketListDoc): number {
  const a = t.amount;
  const p = t.price;
  if (typeof a === 'number' && Number.isFinite(a)) return a;
  if (typeof p === 'number' && Number.isFinite(p)) return p;
  return 0;
}

/** Fila que debe verse como cortesía / $0 (no confundir con compras web donde falta `price`). */
export function isTicketCourtesyRow(t: TicketListDoc): boolean {
  if (t.ticketKind === 'purchase_pass') return false;
  if (t.isCourtesy || t.isGeneralCourtesy) return true;
  return ticketLineAmountCOP(t) === 0;
}

export function ticketListBuyerName(t: TicketListDoc): string {
  const root = typeof t.buyerName === 'string' ? t.buyerName.trim() : '';
  const meta = t.metadata?.userName;
  const fromMeta = typeof meta === 'string' ? meta.trim() : '';
  return root || fromMeta;
}

export function ticketListBuyerIdNumber(t: TicketListDoc): string {
  const root = typeof t.buyerIdNumber === 'string' ? t.buyerIdNumber.trim() : '';
  const meta = t.metadata?.buyerIdNumber;
  const fromMeta = typeof meta === 'string' ? meta.trim() : '';
  return root || fromMeta;
}

export function ticketListBuyerPhone(t: TicketListDoc): string {
  const root = typeof t.buyerPhone === 'string' ? t.buyerPhone.trim() : '';
  const meta = t.metadata?.buyerPhone;
  const fromMeta = typeof meta === 'string' ? meta.trim() : '';
  return root || fromMeta;
}
