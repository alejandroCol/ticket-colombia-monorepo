import * as functions from "firebase-functions/v1";
import * as admin from "firebase-admin";
import {randomUUID} from "crypto";
import {EventServiceFactory, RecurringEvent} from "./features/events";
import {
  PaymentServiceFactory,
  CreateTicketRequest,
  WebhookNotification,
  OnePayWebhookPayload,
} from "./features/payments";
import {onePayWebhookInterestingHeaderKeys} from "./features/payments/handlers/onepay.api";
import {defineSecret} from "firebase-functions/params";
import {createManualTicket} from "./features/manual-ticket/create-manual-ticket";
import {transferTicket} from "./features/ticket-transfer/transfer-ticket";
import {getEventAvailability} from "./features/events/get-event-availability";
import {createTicketReservation} from "./features/reservations/create-ticket-reservation";
import {releaseTicketReservation} from "./features/reservations/release-ticket-reservation";
import {cleanupExpiredReservations} from "./features/reservations/cleanup-expired-reservations";
import {manageEventPromoterGrant} from "./features/promoters/manage-event-promoter-grant";
import {getAbonoCheckoutPublicInfo} from "./features/payments/abono-public-callable";
import {expirePendingInstallments} from "./features/payments/expire-installments";

admin.initializeApp();

// Definir secretos: Mercado Pago, URL app, correo (abono)
const mercadopagoAccessToken = defineSecret("MERCADOPAGO_ACCESS_TOKEN");
const mercadopagoWebhookSecret = defineSecret("MERCADOPAGO_WEBHOOK_SECRET");
const onepayApiKeySecret = defineSecret("ONEPAY_API_KEY");
const onepayWebhookSecret = defineSecret("ONEPAY_WEBHOOK_SECRET");
const onepayWebhookTokenSecret = defineSecret("ONEPAY_WEBHOOK_TOKEN");
const appUrlSecret = defineSecret("APP_URL");
const resendApiKeySecret = defineSecret("RESEND_API_KEY");
const senderEmailSecret = defineSecret("SENDER_EMAIL");
const senderNameSecret = defineSecret("SENDER_NAME");

// Configurar MercadoPago
const isDevelopment = process.env.NODE_ENV !== "production";

async function paymentsConfigProvider(): Promise<string> {
  const snap = await admin
    .firestore()
    .collection("configurations")
    .doc("payments_config")
    .get();
  return String(snap.data()?.payment_provider || "mercadopago").toLowerCase();
}

exports.createStandaloneEventsFromRecurring = functions.firestore
  .document("recurring_events/{eventId}")
  .onCreate(
    async (
      snapshot: functions.firestore.QueryDocumentSnapshot,
      context: functions.EventContext
    ) => {
      const recurringEvent = snapshot.data() as RecurringEvent;
      const eventId = context.params.eventId;

      if (!recurringEvent) {
        console.error("No event data found in the snapshot");
        return null;
      }

      try {
        // Use the event service from our clean architecture
        const eventService = EventServiceFactory.createEventService();
        const result = await eventService.createStandaloneEvents(
          recurringEvent,
          eventId
        );

        if (result.success) {
          const message = `Created ${result.count} standalone events for ` +
            `recurring event ${eventId}`;
          console.log(message);
        } else {
          console.error(`Failed to create standalone events: ${result.error}`);
        }

        return result;
      } catch (error: unknown) {
        console.error("Error creating standalone events:", error);
        return {
          success: false,
          error: error instanceof Error ? error.message : String(error),
        };
      }
    }
  );

// Función para crear ticket y preferencia de pago
exports.createTicketPreference = functions
  .runWith({
    secrets: [
      mercadopagoAccessToken,
      mercadopagoWebhookSecret,
      onepayApiKeySecret,
      onepayWebhookSecret,
      onepayWebhookTokenSecret,
      appUrlSecret,
    ],
  })
  .https.onCall(async (data: CreateTicketRequest, context) => {
    console.log("[createTicketPreference] Llamada recibida", {
      hasAuth: !!context.auth,
      authUid: context.auth?.uid,
      eventId: data?.eventId,
      quantity: data?.quantity,
      amount: data?.amount,
    });
    try {
      let payload = {...data};
      if (!context.auth) {
        if (!data.guestCheckout) {
          throw new functions.https.HttpsError(
            "unauthenticated",
            "Inicia sesión o usa compra sin cuenta"
          );
        }
        if (!data.buyerEmail?.trim() || !data.metadata?.userName?.trim()) {
          throw new functions.https.HttpsError(
            "invalid-argument",
            "Email y nombre completos son requeridos"
          );
        }
        payload = {
          ...data,
          userId: `guest_${randomUUID().replace(/-/g, "")}`,
          guestCheckout: true,
        };
      } else if (context.auth.uid !== data.userId) {
        throw new functions.https.HttpsError(
          "permission-denied",
          "No tienes permisos para crear este ticket"
        );
      }

      const provider = await paymentsConfigProvider();
      const accessToken = mercadopagoAccessToken.value();
      const webhookSecret = mercadopagoWebhookSecret.value();
      const appUrlValue = appUrlSecret.value();
      const oneKey = onepayApiKeySecret.value();
      const oneWh = onepayWebhookSecret.value();
      const oneTok = onepayWebhookTokenSecret.value();

      if (provider === "onepay") {
        if (!oneKey?.trim() || !appUrlValue) {
          throw new functions.https.HttpsError(
            "internal",
            "OnePay no está configurado (ONEPAY_API_KEY / APP_URL)"
          );
        }
      } else if (!accessToken || !webhookSecret || !appUrlValue) {
        throw new functions.https.HttpsError(
          "internal",
          "Payment configuration not properly set"
        );
      }

      const config = PaymentServiceFactory.createPaymentConfig(
        provider === "onepay" ? accessToken || "unused" : accessToken,
        provider === "onepay" ? webhookSecret || "unused" : webhookSecret,
        appUrlValue,
        isDevelopment,
        {
          apiKey: oneKey,
          webhookSecret: oneWh,
          webhookToken: oneTok,
        }
      );

      const paymentService = PaymentServiceFactory.createPaymentService(config);

      const uid = payload.userId;
      const result = await paymentService.createTicketPreference(payload, uid);

      console.log("[createTicketPreference] OK", {ticketId: result?.ticketId});
      return result;
    } catch (error) {
      const err = error as Error;
      console.error("[createTicketPreference] Error:", err.message, err.stack);

      if (error instanceof functions.https.HttpsError) {
        throw error;
      }

      const errorMessage = "Error al crear la preferencia de pago: " + err.message;
      throw new functions.https.HttpsError("internal", errorMessage);
    }
  });

// Webhook para recibir notificaciones de MercadoPago
exports.mercadopagoWebhook = functions
  .runWith({
    secrets: [
      mercadopagoWebhookSecret,
      mercadopagoAccessToken,
      appUrlSecret,
      resendApiKeySecret,
      senderEmailSecret,
      senderNameSecret,
    ],
    /** PDF con muchos pases (bundle) + PDFKit supera 256 MiB */
    memory: "1GB",
    timeoutSeconds: 180,
  })
  .https.onRequest(async (req, res) => {
    try {
      console.log("Webhook received:", JSON.stringify(req.body, null, 2));
      console.log("Headers:", JSON.stringify(req.headers, null, 2));

      if (req.method !== "POST") {
        res.status(405).send("Method not allowed");
        return;
      }

      // Obtener valores de los secretos
      const accessToken = mercadopagoAccessToken.value();
      const webhookSecret = mercadopagoWebhookSecret.value();
      const appUrlValue = appUrlSecret.value();

      // Validar que los secretos estén configurados
      if (!accessToken || !webhookSecret || !appUrlValue) {
        console.error("Payment configuration not properly set");
        res.status(500).send("Configuration error");
        return;
      }

      // Crear configuración y servicio de pagos
      const config = PaymentServiceFactory.createPaymentConfig(
        accessToken,
        webhookSecret,
        appUrlValue,
        isDevelopment
      );
      const rKey = resendApiKeySecret.value();
      const sEmail = senderEmailSecret.value();
      if (rKey && sEmail) {
        config.resend = {
          apiKey: rKey,
          senderEmail: sEmail,
          senderName: senderNameSecret.value() || "Ticket Colombia",
        };
      }

      const paymentService = PaymentServiceFactory.createPaymentService(config);

      // Procesar notificación usando el servicio
      const notification: WebhookNotification = req.body;
      const headers = req.headers as Record<string, string>;

      await paymentService.processWebhookNotification(notification, headers);

      // Responder con 200 OK según documentación de MercadoPago
      res.status(200).send("OK");
    } catch (error) {
      console.error("Error processing webhook:", error);
      // Siempre responder 200 para evitar reintentos innecesarios según documentación
      res.status(200).send("Webhook error logged");
    }
  });

/** Webhook OnePay: registrar URL en panel OnePay → https://docs.onepay.la/guides/implementar-webhooks */
exports.onepayWebhook = functions
  .runWith({
    secrets: [
      onepayApiKeySecret,
      onepayWebhookSecret,
      onepayWebhookTokenSecret,
      mercadopagoAccessToken,
      mercadopagoWebhookSecret,
      appUrlSecret,
      resendApiKeySecret,
      senderEmailSecret,
      senderNameSecret,
    ],
    /** Mismo caso: generateMultipleTicketsPdf con ~100 páginas agota 256 MiB */
    memory: "1GB",
    timeoutSeconds: 180,
  })
  .https.onRequest(async (req, res) => {
    const rawBuf = (req as {rawBody?: Buffer}).rawBody;
    const hasRawBody = Boolean(rawBuf && Buffer.isBuffer(rawBuf));
    const rawBody = (() => {
      if (hasRawBody) {
        return rawBuf!.toString("utf8");
      }
      console.warn(
        "onepayWebhook: req.rawBody ausente; la firma HMAC puede fallar si difiere del JSON recibido"
      );
      return JSON.stringify(req.body ?? {});
    })();

    const hdr = req.headers;
    const sigHdr =
      (Array.isArray(hdr["x-signature"]) ?
        hdr["x-signature"][0] :
        hdr["x-signature"]) || "";
    const tokHdr =
      (Array.isArray(hdr["x-webhook-token"]) ?
        hdr["x-webhook-token"][0] :
        hdr["x-webhook-token"]) || "";
    const hdrLower: Record<string, string> = {};
    for (const [k, v] of Object.entries(req.headers)) {
      if (v === undefined || v === null) continue;
      const val = Array.isArray(v) ? v[0] : v;
      hdrLower[String(k).toLowerCase()] = String(val);
    }
    console.log("[onepayWebhook] POST recibido", {
      hasRawBody,
      rawBodyLength: rawBody.length,
      hasBodyParsed: req.body !== undefined,
      xSignatureLen: String(sigHdr).length,
      xWebhookTokenLen: String(tokHdr).trim().length,
      interestingHeaderKeys: onePayWebhookInterestingHeaderKeys(hdrLower),
    });

    try {
      if (req.method !== "POST") {
        res.status(405).send("Method not allowed");
        return;
      }

      const accessToken = mercadopagoAccessToken.value();
      const mpWh = mercadopagoWebhookSecret.value();
      const appUrlValue = appUrlSecret.value();
      if (!appUrlValue) {
        console.error("APP_URL no configurada");
        res.status(500).send("Configuration error");
        return;
      }

      const config = PaymentServiceFactory.createPaymentConfig(
        accessToken || "unused",
        mpWh || "unused",
        appUrlValue,
        isDevelopment,
        {
          apiKey: onepayApiKeySecret.value(),
          webhookSecret: onepayWebhookSecret.value(),
          webhookToken: onepayWebhookTokenSecret.value(),
        }
      );
      const rKey = resendApiKeySecret.value();
      const sEmail = senderEmailSecret.value();
      if (rKey && sEmail) {
        config.resend = {
          apiKey: rKey,
          senderEmail: sEmail,
          senderName: senderNameSecret.value() || "Ticket Colombia",
        };
      }

      const paymentService = PaymentServiceFactory.createPaymentService(config);
      const parsed = req.body;
      const payload = parsed as OnePayWebhookPayload;
      await paymentService.processOnePayWebhook(
        payload,
        rawBody,
        req.headers as Record<string, string>,
        parsed
      );
      res.status(200).send("OK");
    } catch (error) {
      const err = error as Error;
      const msg = err.message || "";
      console.error("[onepayWebhook] error", {message: msg, stack: err.stack});
      if (
        msg.includes("inválid") ||
        msg.includes("inválido") ||
        msg.includes("no configurado")
      ) {
        console.error(
          "[onepayWebhook] respondiendo 401 — revisa logs anteriores (token o firma). En GCP: Logging filtro text:onepayWebhook"
        );
        res.status(401).send("Unauthorized");
        return;
      }
      res.status(200).send("logged");
    }
  });

// Función temporal de prueba para simular actualización de ticket
exports.testTicketUpdate = functions
  .runWith({
    secrets: [mercadopagoAccessToken, mercadopagoWebhookSecret, appUrlSecret],
  })
  .https.onCall(async (data, context) => {
    try {
      // Verificar autenticación
      if (!context.auth) {
        throw new functions.https.HttpsError(
          "unauthenticated",
          "Usuario debe estar autenticado"
        );
      }

      const {ticketId} = data;
      if (!ticketId) {
        throw new functions.https.HttpsError(
          "invalid-argument",
          "ticketId es requerido"
        );
      }

      // Obtener valores de los secretos
      const accessToken = mercadopagoAccessToken.value();
      const webhookSecret = mercadopagoWebhookSecret.value();
      const appUrlValue = appUrlSecret.value();

      // Crear configuración y servicio de pagos
      const config = PaymentServiceFactory.createPaymentConfig(
        accessToken,
        webhookSecret,
        appUrlValue || "https://bitcomedia-main-app.web.app",
        isDevelopment
      );

      const paymentService = PaymentServiceFactory.createPaymentService(config);

      // Simular datos de pago aprobado
      const mockPaymentData = {
        id: "mock_payment_123",
        status: "approved" as const,
        payment_method_id: "visa",
        external_reference: ticketId,
      };

      await paymentService.updateTicketFromPayment(ticketId, mockPaymentData);

      return {
        success: true,
        message: `Ticket ${ticketId} actualizado exitosamente`,
      };
    } catch (error) {
      console.error("Error in test ticket update:", error);
      throw new functions.https.HttpsError(
        "internal",
        "Error al actualizar ticket: " + (error as Error).message
      );
    }
  });

// Función para crear tickets manuales (sin pago) - Solo para administradores
exports.createManualTicket = createManualTicket;

// Función para transferir tickets a otra persona
exports.transferTicket = transferTicket;

// Obtener disponibilidad por sección (público; incluye reservas activas)
exports.getEventAvailability = getEventAvailability;

// Reserva de cupo 10 min (checkout)
exports.createTicketReservation = createTicketReservation;
exports.releaseTicketReservation = releaseTicketReservation;
exports.cleanupExpiredReservations = cleanupExpiredReservations;

exports.expirePendingInstallments = expirePendingInstallments;

exports.getAbonoCheckoutPublicInfo = getAbonoCheckoutPublicInfo;

exports.createBalanceInstallmentPreference = functions
  .runWith({
    secrets: [
      mercadopagoAccessToken,
      mercadopagoWebhookSecret,
      onepayApiKeySecret,
      onepayWebhookSecret,
      onepayWebhookTokenSecret,
      appUrlSecret,
    ],
  })
  .https.onCall(async (data: { ticketId?: string }, context) => {
    if (!context.auth?.uid) {
      throw new functions.https.HttpsError(
        "unauthenticated",
        "Inicia sesión para pagar el saldo."
      );
    }
    const ticketId = String(data?.ticketId || "").trim();
    if (!ticketId) {
      throw new functions.https.HttpsError("invalid-argument", "Falta ticketId");
    }
    const provider = await paymentsConfigProvider();
    const accessToken = mercadopagoAccessToken.value();
    const webhookSecret = mercadopagoWebhookSecret.value();
    const appUrlValue = appUrlSecret.value();
    const oneKey = onepayApiKeySecret.value();
    const oneWh = onepayWebhookSecret.value();
    const oneTok = onepayWebhookTokenSecret.value();

    if (provider === "onepay") {
      if (!oneKey?.trim() || !appUrlValue) {
        throw new functions.https.HttpsError("internal", "Pago no configurado");
      }
    } else if (!accessToken || !webhookSecret || !appUrlValue) {
      throw new functions.https.HttpsError("internal", "Pago no configurado");
    }
    const config = PaymentServiceFactory.createPaymentConfig(
      provider === "onepay" ? accessToken || "unused" : accessToken,
      provider === "onepay" ? webhookSecret || "unused" : webhookSecret,
      appUrlValue,
      isDevelopment,
      {
        apiKey: oneKey,
        webhookSecret: oneWh,
        webhookToken: oneTok,
      }
    );
    const paymentService = PaymentServiceFactory.createPaymentService(config);
    try {
      return await paymentService.createBalanceInstallmentPreference(
        ticketId,
        context.auth.uid
      );
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      throw new functions.https.HttpsError("failed-precondition", msg);
    }
  });

exports.manageEventPromoterGrant = manageEventPromoterGrant;
