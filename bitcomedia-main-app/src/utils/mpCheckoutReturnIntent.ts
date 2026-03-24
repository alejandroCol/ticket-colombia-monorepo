const RETURN_URL_KEY = 'tc_mp_return_url';
const STARTED_AT_KEY = 'tc_mp_started_at';
/** Tiempo máximo para considerar que el usuario sigue en el flujo MP → sitio */
const MAX_AGE_MS = 45 * 60 * 1000;

function hasMercadoPagoReturnQuery(search: string): boolean {
  const q = search.startsWith('?') ? search.slice(1) : search;
  if (!q) return false;
  const p = new URLSearchParams(q);
  return Boolean(
    p.get('status') ||
      p.get('collection_status') ||
      p.get('payment_id') ||
      p.get('preference_id')
  );
}

/**
 * Guarda la URL de compra finalizada que el backend también usa en back_urls,
 * para redirigir al usuario si MP lo devuelve a /tickets (preferencias viejas, etc.).
 */
export function persistMercadoPagoReturnIntent(absoluteUrl: string): void {
  try {
    sessionStorage.setItem(RETURN_URL_KEY, absoluteUrl);
    sessionStorage.setItem(STARTED_AT_KEY, String(Date.now()));
  } catch {
    /* private mode / quota */
  }
}

export function clearMercadoPagoReturnIntent(): void {
  try {
    sessionStorage.removeItem(RETURN_URL_KEY);
    sessionStorage.removeItem(STARTED_AT_KEY);
  } catch {
    /* ignore */
  }
}

/**
 * Si el invitado llegó a /tickets pero venía de iniciar pago con MP, devuelve
 * `pathname + search` hacia `/compra-finalizada` (fusionando query de MP si viene en la URL).
 */
export function resolvePostMercadoPagoRedirectFromTickets(): string | null {
  const search = window.location.search || '';
  let stored: string | null = null;
  let started: string | null = null;
  try {
    stored = sessionStorage.getItem(RETURN_URL_KEY);
    started = sessionStorage.getItem(STARTED_AT_KEY);
  } catch {
    return null;
  }

  if (!started && !stored) {
    return null;
  }

  if (started) {
    const age = Date.now() - parseInt(started, 10);
    if (age > MAX_AGE_MS || age < 0) {
      clearMercadoPagoReturnIntent();
      return null;
    }
  }

  const mpQuery = hasMercadoPagoReturnQuery(search);

  if (mpQuery && stored) {
    try {
      const target = new URL(stored);
      const extra = new URLSearchParams(search.replace(/^\?/, ''));
      extra.forEach((v, k) => {
        target.searchParams.set(k, v);
      });
      clearMercadoPagoReturnIntent();
      return `${target.pathname}?${target.searchParams.toString()}`;
    } catch {
      clearMercadoPagoReturnIntent();
      return null;
    }
  }

  if (mpQuery) {
    clearMercadoPagoReturnIntent();
    return `/compra-finalizada${search}`;
  }

  if (stored) {
    try {
      const u = new URL(stored);
      clearMercadoPagoReturnIntent();
      return `${u.pathname}${u.search}`;
    } catch {
      clearMercadoPagoReturnIntent();
      return null;
    }
  }

  return null;
}
