import * as crypto from "crypto";

const ONEPAY_API_BASE = "https://api.onepay.la/v1";

/**
 * Limpia valores copiados desde el panel (espacios, comillas, saltos de línea).
 * Doc: el `secret` (wh_tok_) firma `x-signature`; el `header` (wh_hdr_) va en `x-webhook-token`.
 * @see https://docs.onepay.la/client/webhooks/create.md
 * @param {string} value Valor del secret en Firebase
 * @return {string} Valor normalizado
 */
export function normalizeOnePaySecretValue(value: string): string {
  let t = String(value || "").trim();
  if (
    (t.startsWith('"') && t.endsWith('"')) ||
    (t.startsWith("'") && t.endsWith("'"))
  ) {
    t = t.slice(1, -1).trim();
  }
  return t.replace(/\r\n/g, "\n").trim();
}

/**
 * Cabeceras donde OnePay u proxies pueden enviar la firma HMAC.
 * @param {Record<string, string>} headersNorm headers en minúsculas
 * @return {string} Primer valor no vacío o ""
 */
export function collectOnePaySignatureHeader(
  headersNorm: Record<string, string>
): string {
  const keys = [
    "x-signature",
    "x-onepay-signature",
    "x-webhook-signature",
    "onepay-signature",
  ];
  for (const k of keys) {
    const v = headersNorm[k];
    if (v && String(v).trim()) return String(v).trim();
  }
  return "";
}

/**
 * Nombres de cabeceras útiles para depurar entregas sin x-signature.
 * @param {Record<string, string>} headersNorm headers normalizados
 * @return {string[]} Lista de claves
 */
export function onePayWebhookInterestingHeaderKeys(
  headersNorm: Record<string, string>
): string[] {
  return Object.keys(headersNorm).filter((k) =>
    /sig|signature|webhook|onepay|hmac|token|x-/i.test(k)
  );
}

/** Respuesta resumida POST /v1/payments */
export type OnePayPaymentCreateResponse = {
  id: string;
  payment_link?: string;
  status?: string;
  amount?: number;
  external_id?: string | null;
};

/** GET /v1/payments/:id */
export type OnePayPaymentDetail = {
  id: string;
  status?: string;
  amount?: number | string;
  external_id?: string | null;
  externalId?: string | null;
  payment_link?: string;
  payment_method?: string;
};

/**
 * OnePay exige metadata como objeto cuyas propiedades son { key, value } cada una.
 * @param {Array<{key: string; value: string}>} pairs Pares clave/valor
 * @return {Record<string, {key: string; value: string}>} Formato API
 */
export function onepayMetadataForApi(
  pairs: Array<{key: string; value: string}>
): Record<string, {key: string; value: string}> {
  const out: Record<string, {key: string; value: string}> = {};
  for (const p of pairs) {
    const k = String(p.key || "").trim();
    if (!k) continue;
    out[k] = {key: k, value: String(p.value ?? "")};
  }
  return out;
}

/**
 * Crea un cobro (link de pago) — https://docs.onepay.la/client/payments/create
 * @param {object} params Argumentos del cobro
 * @return {Promise<OnePayPaymentCreateResponse>} Respuesta API
 */
export async function onepayCreatePayment(params: {
  apiKey: string;
  amount: number;
  title: string;
  email: string;
  externalId: string;
  reference: string;
  redirectUrl: string;
  idempotencyKey: string;
  description?: string;
  /** Cada ítem se serializa como metadata[nombre] = { key, value } */
  metadataPairs?: Array<{key: string; value: string}>;
}): Promise<OnePayPaymentCreateResponse> {
  const body: Record<string, unknown> = {
    amount: Math.round(params.amount),
    currency: "COP",
    title: params.title,
    email: params.email,
    external_id: params.externalId,
    reference: params.reference,
    redirect_url: params.redirectUrl,
    allows: {
      cards: true,
      accounts: true,
      pse: true,
      breb: true,
    },
  };
  if (params.description) body.description = params.description;
  if (params.metadataPairs?.length) {
    const meta = onepayMetadataForApi(params.metadataPairs);
    if (Object.keys(meta).length) body.metadata = meta;
  }

  const res = await fetch(`${ONEPAY_API_BASE}/payments`, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${params.apiKey}`,
      "Content-Type": "application/json",
      "x-idempotency": params.idempotencyKey,
    },
    body: JSON.stringify(body),
  });

  const text = await res.text();
  if (!res.ok) {
    throw new Error(`OnePay create payment ${res.status}: ${text}`);
  }
  return JSON.parse(text) as OnePayPaymentCreateResponse;
}

/**
 * Consulta un cobro por id — https://docs.onepay.la/client/payments/detail
 * @param {string} apiKey Bearer sk_*
 * @param {string} paymentId UUID del cobro
 * @return {Promise<OnePayPaymentDetail>} Detalle
 */
export async function onepayGetPayment(
  apiKey: string,
  paymentId: string
): Promise<OnePayPaymentDetail> {
  const res = await fetch(
    `${ONEPAY_API_BASE}/payments/${encodeURIComponent(paymentId)}`,
    {
      method: "GET",
      headers: {"Authorization": `Bearer ${apiKey}`},
    }
  );
  const text = await res.text();
  if (!res.ok) {
    throw new Error(`OnePay get payment ${res.status}: ${text}`);
  }
  return JSON.parse(text) as OnePayPaymentDetail;
}

/** Cobro tipo “cargo” (tarjeta/PSE) — webhooks `charge.*` */
export type OnePayChargeWebhook = {
  id?: string;
  status?: string;
  amount?: number;
  external_id?: string | null;
  externalId?: string | null;
  payment_method_type?: string;
  payment_method_id?: string;
  metadata?: Record<string, unknown> | unknown[];
  source?: {
    type?: string;
    id?: string;
  };
};

/** Payload típico webhook `payment.*` o `charge.*` */
export type OnePayWebhookPayload = {
  payment?: {
    id?: string;
    status?: string;
    amount?: number | string;
    external_id?: string | null;
    externalId?: string | null;
    payment_method?: string;
    metadata?: Record<string, unknown> | unknown[];
  };
  charge?: OnePayChargeWebhook;
  event?: {
    type?: string;
    id?: string;
    timestamp?: number;
    environment?: string;
  };
};

/**
 * external_id que envía la API (snake) o variantes camelCase.
 * @param {Record<string, unknown>|null|undefined} obj payment o charge
 * @return {string} id externo recortado
 */
export function onepayPickExternalId(
  obj: Record<string, unknown> | null | undefined
): string {
  if (!obj || typeof obj !== "object") return "";
  const ex =
    (obj as {external_id?: unknown}).external_id ??
    (obj as {externalId?: unknown}).externalId;
  return String(ex ?? "").trim();
}

/**
 * Busca ticketId en metadata OnePay (objeto o arreglo key/value).
 * @param {unknown} meta metadata del webhook
 * @return {string} ticketId o ""
 */
function metaEntryValue(entry: unknown): string {
  if (entry === null || entry === undefined) return "";
  if (typeof entry === "string" || typeof entry === "number") {
    return String(entry).trim();
  }
  if (typeof entry === "object" && !Array.isArray(entry)) {
    const o = entry as {value?: unknown; key?: string};
    if (o.value !== undefined && o.value !== null) {
      return String(o.value).trim();
    }
  }
  return "";
}

export function ticketIdFromOnePayMetadata(meta: unknown): string {
  if (!meta) return "";
  if (Array.isArray(meta)) {
    for (const item of meta) {
      if (!item || typeof item !== "object") continue;
      const k = String((item as {key?: string}).key || "").toLowerCase();
      if (k === "ticketid" || k === "ticket_id") {
        return String((item as {value?: string}).value || "").trim();
      }
    }
    return "";
  }
  if (typeof meta !== "object") return "";
  const m = meta as Record<string, unknown>;
  const direct = metaEntryValue(m.ticketId ?? m.ticket_id);
  if (direct) return direct;
  for (const v of Object.values(m)) {
    if (!v || typeof v !== "object") continue;
    const inner = v as {key?: string; value?: unknown};
    const k = String(inner.key || "").toLowerCase();
    if (k === "ticketid" || k === "ticket_id") {
      return String(inner.value ?? "").trim();
    }
  }
  return "";
}

/**
 * HMAC-SHA256 del body; compara con header en hex (64 chars) o Base64 (32 bytes).
 * @return {boolean} true si coincide
 */
export function onePayHmacHexMatchesBody(
  body: string,
  webhookSecret: string,
  signatureHeader: string | undefined
): boolean {
  if (!signatureHeader || !webhookSecret || body.length === 0) return false;
  let sigIn = String(signatureHeader).trim();
  const low = sigIn.toLowerCase();
  if (low.startsWith("sha256=")) {
    sigIn = sigIn.slice(7).trim();
  }
  const expectedBuf = crypto
    .createHmac("sha256", webhookSecret)
    .update(body, "utf8")
    .digest();

  const sigHex = sigIn.replace(/^0x/i, "").toLowerCase();
  if (/^[0-9a-f]+$/.test(sigHex) && sigHex.length % 2 === 0) {
    try {
      const sigBuf = Buffer.from(sigHex, "hex");
      if (sigBuf.length !== expectedBuf.length) return false;
      return crypto.timingSafeEqual(sigBuf, expectedBuf);
    } catch {
      return false;
    }
  }
  try {
    const sigBuf = Buffer.from(sigIn, "base64");
    if (sigBuf.length === expectedBuf.length) {
      return crypto.timingSafeEqual(sigBuf, expectedBuf);
    }
  } catch {
    /* ignore */
  }
  return false;
}

/**
 * Verifica HMAC solo con un cuerpo (retrocompat).
 */
export function verifyOnePayWebhookSignature(
  rawBody: string,
  webhookSecret: string,
  signatureHeader: string | undefined
): boolean {
  return onePayHmacHexMatchesBody(rawBody, webhookSecret, signatureHeader);
}

/**
 * OnePay documenta `JSON.stringify(req.body)` en Node ([guía webhooks](https://docs.onepay.la/guides/implementar-webhooks))
 * y el body crudo en PHP. Firebase suele exponer `req.rawBody`; si solo uno coincide con el HMAC, aceptamos.
 * @param {string} rawBody Bytes del POST tal cual (si existen)
 * @param {unknown} parsedBody Objeto ya parseado (req.body)
 * @return {boolean} true si alguna variante del cuerpo valida la firma
 */
/** Detalle de intentos de verificación (para logs; sin secretos). */
export type OnePaySigCheckAttempt = {source: "rawBody" | "jsonStringify"; ok: boolean};

export function verifyOnePayWebhookSignatureAny(
  rawBody: string,
  parsedBody: unknown,
  webhookSecret: string,
  signatureHeader: string | undefined
): boolean {
  return verifyOnePayWebhookSignatureDetailed(
    rawBody,
    parsedBody,
    webhookSecret,
    signatureHeader
  ).ok;
}

/**
 * Igual que verifyOnePayWebhookSignatureAny pero devuelve qué variante del body validó.
 * @return {{ ok: boolean; attempts: OnePaySigCheckAttempt[] }} Resultado
 */
export function verifyOnePayWebhookSignatureDetailed(
  rawBody: string,
  parsedBody: unknown,
  webhookSecret: string,
  signatureHeader: string | undefined
): {ok: boolean; attempts: OnePaySigCheckAttempt[]} {
  const attempts: OnePaySigCheckAttempt[] = [];
  if (!signatureHeader || !webhookSecret) {
    return {ok: false, attempts};
  }

  /** Priorizar JSON.stringify: guía Node de OnePay firma `JSON.stringify(req.body)` */
  const parts: Array<{source: "rawBody" | "jsonStringify"; body: string}> = [];
  if (parsedBody !== undefined && parsedBody !== null) {
    try {
      parts.push({source: "jsonStringify", body: JSON.stringify(parsedBody)});
    } catch {
      /* ignore */
    }
  }
  if (rawBody?.length) parts.push({source: "rawBody", body: rawBody});
  const seen = new Set<string>();
  for (const {source, body} of parts) {
    if (!body || seen.has(body)) continue;
    seen.add(body);
    const ok = onePayHmacHexMatchesBody(body, webhookSecret, signatureHeader);
    attempts.push({source, ok});
    if (ok) return {ok: true, attempts};
  }
  return {ok: false, attempts};
}

/**
 * Aplana variantes de envelope que algunos proxies pueden añadir.
 * @param {unknown} body req.body
 * @return {OnePayWebhookPayload} Payload con payment/charge/event
 */
export function normalizeOnePayWebhookPayload(body: unknown): OnePayWebhookPayload {
  if (!body || typeof body !== "object") return {};
  const b = body as Record<string, unknown>;
  if (b.payment || b.charge || b.event) {
    return {
      payment: b.payment as OnePayWebhookPayload["payment"],
      charge: b.charge as OnePayWebhookPayload["charge"],
      event: b.event as OnePayWebhookPayload["event"],
    };
  }
  const data = b.data;
  if (data && typeof data === "object") {
    const d = data as Record<string, unknown>;
    return {
      payment: d.payment as OnePayWebhookPayload["payment"],
      charge: d.charge as OnePayWebhookPayload["charge"],
      event: d.event as OnePayWebhookPayload["event"],
    };
  }
  return b as OnePayWebhookPayload;
}

/**
 * Estados OnePay / eventos → curso interno (Mercado Pago).
 * @param {string|undefined} status Estado del cobro
 * @param {string|undefined} eventType p.ej. payment.approved
 * @return {"approved"|"rejected"|"pending"|null} Acción o null
 */
export function mapOnePayPaymentStatusToInternal(
  status: string | undefined,
  eventType: string | undefined
): "approved" | "rejected" | "pending" | null {
  const s = String(status || "").toLowerCase();
  const ev = String(eventType || "");

  // Doc oficial: payment.approved, charge.succeeded — ver
  // https://docs.onepay.la/client/webhooks
  if (
    ev === "payment.approved" ||
    ev === "charge.succeeded" ||
    ev === "charge.paid" ||
    s === "approved" ||
    s === "succeeded" ||
    s === "completed" ||
    s === "paid"
  ) {
    return "approved";
  }

  if (
    ev === "payment.declined" ||
    ev === "payment.rejected" ||
    ev === "payment.cancelled" ||
    ev === "payment.canceled" ||
    ev === "payment.deleted" ||
    ev === "payment.expired" ||
    ev === "charge.declined" ||
    ev === "charge.failed" ||
    ev === "charge.refunded" ||
    s === "failed" ||
    s === "declined" ||
    s === "rejected" ||
    s === "cancelled" ||
    s === "canceled" ||
    s === "expired" ||
    s === "refunded"
  ) {
    return "rejected";
  }

  if (
    s === "pending" ||
    s === "processing" ||
    s === "in_progress" ||
    s === "created" ||
    ev === "payment.created" ||
    ev === "charge.created" ||
    ev === "charge.processing" ||
    ev === "charge.disputed"
  ) {
    return "pending";
  }

  return null;
}

/**
 * Normaliza monto OnePay a entero COP.
 * @param {number|string|undefined} amount Valor API
 * @return {number} COP entero
 */
export function onepayAmountToNumber(amount: number | string | undefined): number {
  if (amount === undefined || amount === null) return 0;
  if (typeof amount === "number") return Math.round(amount);
  const n = parseInt(String(amount).replace(/\D/g, ""), 10);
  return Number.isFinite(n) ? n : 0;
}
