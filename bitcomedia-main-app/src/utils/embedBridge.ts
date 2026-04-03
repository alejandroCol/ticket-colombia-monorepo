/** Protocolo postMessage para checkout embebido en iframe (widget externo). */

export const EMBED_MSG_SOURCE = "ticket-colombia-embed" as const;
export const EMBED_MSG_VERSION = 1 as const;

export type EmbedPurchaseStatus =
  | "approved"
  | "pending"
  | "rejected"
  | "unknown";

export type EmbedMessageToParent =
  | {
      source: typeof EMBED_MSG_SOURCE;
      version: typeof EMBED_MSG_VERSION;
      kind: "purchase_finished";
      status: EmbedPurchaseStatus;
      eventSlug?: string | null;
      amount?: number | null;
      qty?: string | null;
    }
  | {
      source: typeof EMBED_MSG_SOURCE;
      version: typeof EMBED_MSG_VERSION;
      kind: "embed_close";
      reason?: string;
    };

export function isEmbeddedCheckout(): boolean {
  try {
    return window.parent !== window;
  } catch {
    return false;
  }
}

/** Notifica al documento padre (solo si estamos en iframe). */
export function postToEmbedParent(payload: EmbedMessageToParent): void {
  if (!isEmbeddedCheckout()) return;
  try {
    window.parent.postMessage(payload, "*");
  } catch {
    /* ignore */
  }
}
