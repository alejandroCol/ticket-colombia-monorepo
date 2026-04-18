import * as functions from "firebase-functions/v1";
import * as admin from "firebase-admin";
import * as crypto from "crypto";
import {defineSecret} from "firebase-functions/params";

const mercadopagoClientId = defineSecret("MERCADOPAGO_CLIENT_ID");
const mercadopagoClientSecret = defineSecret("MERCADOPAGO_CLIENT_SECRET");
const adminUrlSecret = defineSecret("ADMIN_URL");
const appUrlSecret = defineSecret("APP_URL");

/** Región por defecto de despliegue (debe coincidir con la URL registrada en Mercado Pago). */
const DEFAULT_FUNCTIONS_REGION = "us-central1";

const STATE_TTL_MS = 15 * 60 * 1000;

const MP_AUTH_CO = "https://auth.mercadopago.com.co/authorization";
const MP_TOKEN = "https://api.mercadopago.com/oauth/token";

function oauthRedirectUri(): string {
  const project =
    process.env.GCLOUD_PROJECT?.trim() ||
    process.env.GCP_PROJECT?.trim() ||
    "";
  if (!project) {
    return "";
  }
  return `https://${DEFAULT_FUNCTIONS_REGION}-${project}.cloudfunctions.net/mercadopagoOAuthCallback`;
}

function signState(organizerId: string, clientSecret: string): string {
  const exp = Date.now() + STATE_TTL_MS;
  const payload = `${organizerId}|${exp}`;
  const sig = crypto
    .createHmac("sha256", clientSecret)
    .update(payload)
    .digest("hex");
  return Buffer.from(
    JSON.stringify({o: organizerId, exp, sig}),
    "utf8"
  ).toString("base64url");
}

function parseState(
  state: string,
  clientSecret: string
): { organizerId: string } | null {
  try {
    const raw = Buffer.from(state, "base64url").toString("utf8");
    const j = JSON.parse(raw) as {o?: string; exp?: number; sig?: string};
    if (!j.o || !j.exp || !j.sig) return null;
    if (Date.now() > j.exp) return null;
    const payload = `${j.o}|${j.exp}`;
    const expected = crypto
      .createHmac("sha256", clientSecret)
      .update(payload)
      .digest("hex");
    if (expected !== j.sig) return null;
    return {organizerId: j.o};
  } catch {
    return null;
  }
}

/**
 * Super admin puede vincular cualquier organizador; un ADMIN solo el suyo (mismo uid).
 */
async function assertMercadoPagoSellerOAuthPermission(
  callerUid: string,
  organizerId: string
): Promise<void> {
  const snap = await admin.firestore().collection("users").doc(callerUid).get();
  const role = String(snap.data()?.role || "").trim();
  const r = role.toUpperCase();
  if (r === "SUPER_ADMIN") {
    return;
  }
  if (organizerId !== callerUid) {
    throw new functions.https.HttpsError(
      "permission-denied",
      "Solo puedes vincular tu propia cuenta Mercado Pago."
    );
  }
  if (r !== "ADMIN" && role !== "admin") {
    throw new functions.https.HttpsError(
      "permission-denied",
      "Solo administradores pueden vincular Mercado Pago."
    );
  }
}

async function exchangeCodeForToken(
  code: string,
  redirectUri: string,
  clientId: string,
  clientSecret: string
): Promise<{
  access_token?: string;
  refresh_token?: string;
  public_key?: string;
  user_id?: number;
  expires_in?: number;
  scope?: string;
}> {
  const body = new URLSearchParams({
    client_id: clientId,
    client_secret: clientSecret,
    grant_type: "authorization_code",
    code,
    redirect_uri: redirectUri,
  });
  const res = await fetch(MP_TOKEN, {
    method: "POST",
    headers: {"Content-Type": "application/x-www-form-urlencoded"},
    body: body.toString(),
  });
  const text = await res.text();
  if (!res.ok) {
    throw new Error(`oauth/token ${res.status}: ${text}`);
  }
  return JSON.parse(text) as {
    access_token?: string;
    refresh_token?: string;
    public_key?: string;
    user_id?: number;
    expires_in?: number;
    scope?: string;
  };
}

function adminConfigRedirectBase(): string {
  const admin = adminUrlSecret.value()?.trim();
  const app = appUrlSecret.value()?.trim();
  const base = admin || app;
  return (base || "").replace(/\/$/, "");
}

function redirectWithParams(
  res: functions.Response,
  params: Record<string, string>
): void {
  const base = adminConfigRedirectBase();
  if (!base) {
    res.status(500).send(
      "Falta ADMIN_URL o APP_URL en secretos para redirigir tras OAuth."
    );
    return;
  }
  const url = `${base}/config?${new URLSearchParams(params).toString()}`;
  res.redirect(302, url);
}

/**
 * Devuelve la URL de autorización OAuth para vincular un vendedor (organizador).
 * Super admin: cualquier organizerId. Admin: solo el propio uid.
 */
export const getMercadoPagoSellerOAuthUrl = functions
  .runWith({
    secrets: [mercadopagoClientId, mercadopagoClientSecret],
  })
  .https.onCall(async (data: { organizerId?: string }, context) => {
    if (!context.auth?.uid) {
      throw new functions.https.HttpsError(
        "unauthenticated",
        "Inicia sesión en el panel admin."
      );
    }

    const organizerId = String(data?.organizerId || "").trim();
    if (!organizerId) {
      throw new functions.https.HttpsError(
        "invalid-argument",
        "Falta organizerId"
      );
    }

    await assertMercadoPagoSellerOAuthPermission(context.auth.uid, organizerId);

    const clientId = mercadopagoClientId.value()?.trim();
    const clientSecret = mercadopagoClientSecret.value()?.trim();
    if (!clientId || !clientSecret) {
      throw new functions.https.HttpsError(
        "failed-precondition",
        "Configura los secretos MERCADOPAGO_CLIENT_ID y MERCADOPAGO_CLIENT_SECRET."
      );
    }

    const redirectUri = oauthRedirectUri();
    if (!redirectUri) {
      throw new functions.https.HttpsError(
        "failed-precondition",
        "No se pudo determinar la Redirect URL (GCLOUD_PROJECT)."
      );
    }

    const state = signState(organizerId, clientSecret);
    const u = new URL(MP_AUTH_CO);
    u.searchParams.set("client_id", clientId);
    u.searchParams.set("response_type", "code");
    u.searchParams.set("platform_id", "mp");
    u.searchParams.set("redirect_uri", redirectUri);
    u.searchParams.set("state", state);

    return {url: u.toString()};
  });

/**
 * Callback OAuth: intercambia `code` por tokens y guarda en organizer_mp_seller.
 */
export const mercadopagoOAuthCallback = functions
  .runWith({
    secrets: [
      mercadopagoClientId,
      mercadopagoClientSecret,
      adminUrlSecret,
      appUrlSecret,
    ],
  })
  .https.onRequest(async (req, res) => {
    if (req.method !== "GET") {
      res.status(405).send("Method not allowed");
      return;
    }

    const q = req.query as Record<string, string | string[] | undefined>;
    const err = String(q.error || "").trim();
    if (err) {
      const desc = String(q.error_description || err);
      redirectWithParams(res, {mp_oauth: "error", mp_oauth_msg: desc});
      return;
    }

    const code = String(q.code || "").trim();
    const state = String(q.state || "").trim();
    if (!code || !state) {
      redirectWithParams(res, {
        mp_oauth: "error",
        mp_oauth_msg: "Falta code o state en la respuesta de Mercado Pago.",
      });
      return;
    }

    const clientId = mercadopagoClientId.value()?.trim();
    const clientSecret = mercadopagoClientSecret.value()?.trim();
    if (!clientId || !clientSecret) {
      redirectWithParams(res, {
        mp_oauth: "error",
        mp_oauth_msg: "Servidor sin MERCADOPAGO_CLIENT_ID / MERCADOPAGO_CLIENT_SECRET.",
      });
      return;
    }

    const redirectUri = oauthRedirectUri();
    if (!redirectUri) {
      redirectWithParams(res, {
        mp_oauth: "error",
        mp_oauth_msg: "Redirect URI no disponible.",
      });
      return;
    }

    const parsed = parseState(state, clientSecret);
    if (!parsed) {
      redirectWithParams(res, {
        mp_oauth: "error",
        mp_oauth_msg: "State inválido o expirado. Genera el enlace de nuevo.",
      });
      return;
    }

    let tokenJson: Awaited<ReturnType<typeof exchangeCodeForToken>>;
    try {
      tokenJson = await exchangeCodeForToken(
        code,
        redirectUri,
        clientId,
        clientSecret
      );
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      console.error("[mercadopagoOAuthCallback] token exchange:", msg);
      redirectWithParams(res, {
        mp_oauth: "error",
        mp_oauth_msg: msg.slice(0, 400),
      });
      return;
    }

    const accessToken = String(tokenJson.access_token || "").trim();
    if (!accessToken) {
      redirectWithParams(res, {
        mp_oauth: "error",
        mp_oauth_msg: "Mercado Pago no devolvió access_token.",
      });
      return;
    }

    const expiresIn = Number(tokenJson.expires_in) || 0;
    const expiresAtMs = expiresIn > 0 ? Date.now() + expiresIn * 1000 : null;

    await admin
      .firestore()
      .collection("organizer_mp_seller")
      .doc(parsed.organizerId)
      .set(
        {
          access_token: accessToken,
          ...(tokenJson.refresh_token ?
            {refresh_token: String(tokenJson.refresh_token)} :
            {}),
          ...(tokenJson.public_key ?
            {public_key: String(tokenJson.public_key)} :
            {}),
          ...(tokenJson.user_id != null ?
            {mp_user_id: Number(tokenJson.user_id)} :
            {}),
          ...(tokenJson.scope ? {scope: String(tokenJson.scope)} : {}),
          ...(expiresAtMs != null ?
            {token_expires_at: admin.firestore.Timestamp.fromMillis(expiresAtMs)} :
            {}),
          oauth_connected_at: admin.firestore.FieldValue.serverTimestamp(),
          updated_at: admin.firestore.FieldValue.serverTimestamp(),
        },
        {merge: true}
      );

    console.log(
      "[mercadopagoOAuthCallback] OK organizer:",
      parsed.organizerId.slice(0, 8)
    );
    redirectWithParams(res, {mp_oauth: "success"});
  });
