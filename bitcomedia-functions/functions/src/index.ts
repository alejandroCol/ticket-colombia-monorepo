import * as functions from "firebase-functions/v1";
import * as admin from "firebase-admin";
import {EventServiceFactory, RecurringEvent} from "./features/events";
import {
  PaymentServiceFactory,
  CreateTicketRequest,
  WebhookNotification,
} from "./features/payments";
import {defineSecret} from "firebase-functions/params";
import {createManualTicket} from "./features/manual-ticket/create-manual-ticket";

admin.initializeApp();

// Definir secretos usando el nuevo sistema de Firebase Functions
const mercadopagoAccessToken = defineSecret("MERCADOPAGO_ACCESS_TOKEN");
const mercadopagoWebhookSecret = defineSecret("MERCADOPAGO_WEBHOOK_SECRET");
const appUrlSecret = defineSecret("APP_URL");

// Configurar MercadoPago
const isDevelopment = process.env.NODE_ENV !== "production";

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
    secrets: [mercadopagoAccessToken, mercadopagoWebhookSecret, appUrlSecret],
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
      // Verificar autenticación
      if (!context.auth) {
        throw new functions.https.HttpsError(
          "unauthenticated",
          "Usuario debe estar autenticado"
        );
      }

      // Verificar que el userId coincida con el usuario autenticado
      if (context.auth.uid !== data.userId) {
        throw new functions.https.HttpsError(
          "permission-denied",
          "No tienes permisos para crear este ticket"
        );
      }

      // Obtener valores de los secretos
      const accessToken = mercadopagoAccessToken.value();
      const webhookSecret = mercadopagoWebhookSecret.value();
      const appUrlValue = appUrlSecret.value();

      // Validar que los secretos estén configurados
      if (!accessToken || !webhookSecret || !appUrlValue) {
        throw new functions.https.HttpsError(
          "internal",
          "Payment configuration not properly set"
        );
      }

      // Crear configuración y servicio de pagos
      const config = PaymentServiceFactory.createPaymentConfig(
        accessToken,
        webhookSecret,
        appUrlValue,
        isDevelopment
      );

      const paymentService = PaymentServiceFactory.createPaymentService(config);

      // Crear ticket y preferencia usando el servicio
      const result = await paymentService.createTicketPreference(data, context.auth.uid);

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
    secrets: [mercadopagoWebhookSecret, mercadopagoAccessToken, appUrlSecret],
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
