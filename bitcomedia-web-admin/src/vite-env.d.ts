/// <reference types="vite/client" />
/// <reference types="vite-plugin-pwa/client" />

interface ImportMetaEnv {
  readonly VITE_PUBLIC_TICKET_APP_ORIGIN?: string;
  /** URL del HTTP function `onepayWebhook` si difiere del proyecto por defecto */
  readonly VITE_ONEPAY_WEBHOOK_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
