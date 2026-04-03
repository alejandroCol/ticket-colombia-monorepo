/**
 * URLs de Cloud Functions expuestas al configurar integraciones externas (p. ej. OnePay).
 * Por defecto coinciden con `bitcomedia-functions/.firebaserc` y región típica de Functions v1.
 * Opcional: define `VITE_ONEPAY_WEBHOOK_URL` si despliegas en otro proyecto o URL.
 */
const DEFAULT_REGION = 'us-central1';
const DEFAULT_PROJECT_ID = 'ticket-colombia-e6267';

export function getOnePayWebhookUrl(): string {
  const fromEnv = import.meta.env.VITE_ONEPAY_WEBHOOK_URL?.trim();
  if (fromEnv) {
    return fromEnv;
  }
  return `https://${DEFAULT_REGION}-${DEFAULT_PROJECT_ID}.cloudfunctions.net/onepayWebhook`;
}
