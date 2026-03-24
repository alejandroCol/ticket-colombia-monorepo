/**
 * Parámetros que Mercado Pago agrega al redirigir desde Checkout Pro (GET).
 * @see https://www.mercadopago.com.co/developers/es/docs/checkout-pro/configure-back-urls
 */
export type MercadoPagoReturnUiState = 'approved' | 'pending' | 'rejected' | 'unknown';

const normalize = (s: string | null) => (s || '').trim().toLowerCase();

/**
 * Estado solo para mensajes en pantalla. La fuente de verdad del negocio es el webhook + API MP.
 */
export function resolveMercadoPagoReturnUiState(
  searchParams: URLSearchParams
): MercadoPagoReturnUiState {
  const status = normalize(searchParams.get('status'));
  const collectionStatus = normalize(searchParams.get('collection_status'));
  const raw = status || collectionStatus;

  if (!raw) {
    return 'unknown';
  }

  if (raw === 'approved') {
    return 'approved';
  }

  if (
    raw === 'pending' ||
    raw === 'in_process' ||
    raw === 'in_mediation'
  ) {
    return 'pending';
  }

  if (
    raw === 'rejected' ||
    raw === 'cancelled' ||
    raw === 'refunded' ||
    raw === 'charged_back'
  ) {
    return 'rejected';
  }

  return 'unknown';
}

export function readMercadoPagoReturnIds(searchParams: URLSearchParams): {
  paymentId: string | null;
  preferenceId: string | null;
  externalReference: string | null;
} {
  return {
    paymentId:
      searchParams.get('payment_id') || searchParams.get('collection_id'),
    preferenceId: searchParams.get('preference_id'),
    externalReference: searchParams.get('external_reference'),
  };
}
