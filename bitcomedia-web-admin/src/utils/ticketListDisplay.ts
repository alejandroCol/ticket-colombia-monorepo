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

/** Fila de listado admin: una entrada válida por QR (oculta el padre de bundle de pago). */
export function isAdminTicketRowVisible(t: {
  ticketKind?: string;
}): boolean {
  return t.ticketKind !== 'purchase_bundle_parent';
}

export type ParentBundleInfo = { amount: number; childCount: number };

export function buildParentBundleInfoMap(
  tickets: Array<
    TicketListDoc & {
      id?: string;
      ticketKind?: string;
      childTicketIds?: string[];
    }
  >
): Map<string, ParentBundleInfo> {
  const m = new Map<string, ParentBundleInfo>();
  for (const t of tickets) {
    if (t.ticketKind === 'purchase_bundle_parent' && t.id) {
      const ids = t.childTicketIds;
      const childCount = Array.isArray(ids) ? ids.length : 0;
      m.set(t.id, { amount: ticketLineAmountCOP(t), childCount });
    }
  }
  return m;
}

/**
 * Precio mostrado por fila: en pases de bundle, total del padre / número de pases.
 */
export function ticketPerBoletoAmountCOP(
  t: TicketListDoc & {
    ticketKind?: string;
    bundleParentTicketId?: string;
    passCount?: number;
  },
  parentMap: Map<string, ParentBundleInfo>
): number {
  if (t.ticketKind === 'purchase_pass' && t.bundleParentTicketId) {
    const p = parentMap.get(t.bundleParentTicketId);
    if (p && p.childCount > 0) {
      return Math.round(p.amount / p.childCount);
    }
    if (typeof t.passCount === 'number' && t.passCount > 0) {
      const amt = parentMap.get(t.bundleParentTicketId)?.amount;
      if (amt !== undefined) return Math.round(amt / t.passCount);
    }
  }
  return ticketLineAmountCOP(t);
}
