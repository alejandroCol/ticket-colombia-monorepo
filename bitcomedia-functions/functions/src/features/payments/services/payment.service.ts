import * as admin from "firebase-admin";
import {
  PaymentService,
  CreateTicketRequest,
  PreferenceResponse,
  WebhookNotification,
  PaymentData,
  TicketRepository,
  PaymentProvider,
  QRCodeGenerator,
  PaymentConfig,
  Ticket,
} from "../types";
import {consumeReservation, restoreReservationActive} from "../../reservations/consume-reservation";
import {assertEnoughCapacityForPurchase} from "../../reservations/availability";
import {
  expectedTotalCOP,
  unitPriceFromEventData,
  type OrganizerBuyerFeeInput,
} from "../pricing-from-event";

const RESERVATION_HOLD_MS = 10 * 60 * 1000;

async function loadOrganizerBuyerFee(
  db: admin.firestore.Firestore,
  organizerId: string
): Promise<OrganizerBuyerFeeInput> {
  const id = String(organizerId || "").trim();
  if (!id) return null;
  const snap = await db.collection("organizer_buyer_fees").doc(id).get();
  if (!snap.exists) return null;
  const d = snap.data()!;
  const t = String(d.fee_type || "").trim();
  const v = Number(d.fee_value) || 0;
  if (!t || t === "none" || v <= 0) return null;
  if (t !== "percent_payer" && t !== "fixed_per_ticket") return null;
  return { type: t, value: v };
}

/**
 * Servicio principal de pagos
 */
export class MercadoPagoPaymentService implements PaymentService {
  private ticketRepository: TicketRepository;
  private paymentProvider: PaymentProvider;
  private qrGenerator: QRCodeGenerator;
  private config: PaymentConfig;

  /**
   * Constructor del servicio de pagos
   * @param {TicketRepository} ticketRepository - Repositorio de tickets
   * @param {PaymentProvider} paymentProvider - Proveedor de pagos
   * @param {QRCodeGenerator} qrGenerator - Generador de códigos QR
   * @param {PaymentConfig} config - Configuración del servicio
   */
  constructor(
    ticketRepository: TicketRepository,
    paymentProvider: PaymentProvider,
    qrGenerator: QRCodeGenerator,
    config: PaymentConfig
  ) {
    this.ticketRepository = ticketRepository;
    this.paymentProvider = paymentProvider;
    this.qrGenerator = qrGenerator;
    this.config = config;
  }

  /**
   * Crea un ticket y una preferencia de pago
   * @param {CreateTicketRequest} request - Datos de la solicitud
   * @param {string} userId - ID del usuario autenticado
   * @return {Promise<PreferenceResponse>} Respuesta con datos de la preferencia
   */
  async createTicketPreference(
    request: CreateTicketRequest,
    userId: string
  ): Promise<PreferenceResponse> {
    try {
      // Validar cantidad
      if (!request.quantity || request.quantity < 1) {
        throw new Error("La cantidad debe ser mayor a 0");
      }

      const mode = this.config.isDevelopment ? "DEVELOPMENT" : "PRODUCTION";
      console.log(`[createTicketPreference] Inicio: mode=${mode}, userId=${userId}, eventId=${request.eventId}, quantity=${request.quantity}, amount=${request.amount}`);

      const db = admin.firestore();

      // Obtener datos del evento (eventos puntuales o recurrentes)
      console.log("[createTicketPreference] Leyendo evento:", request.eventId);
      let eventDoc = await db.collection("events").doc(request.eventId).get();
      if (!eventDoc.exists) {
        eventDoc = await db.collection("recurring_events").doc(request.eventId).get();
      }
      if (!eventDoc.exists) {
        throw new Error("Evento no encontrado");
      }
      const eventData = eventDoc.data()!;
      console.log("[createTicketPreference] Evento OK:", eventData?.name);

      const payCfgSnap = await db.collection("configurations").doc("payments_config").get();
      const rawGlobalFees = payCfgSnap.exists ?
        Number(payCfgSnap.data()?.fees) :
        9;
      const globalFeesPercent = Number.isFinite(rawGlobalFees) ? rawGlobalFees : 9;

      const unitPriceCOP = unitPriceFromEventData(
        eventData,
        request.metadata?.sectionId
      );
      const subtotalCOP = Math.round(unitPriceCOP * request.quantity);

      const reservationId = request.reservationId?.trim();
      if (!reservationId) {
        throw new Error(
          "Falta la reserva de cupo. Vuelve al evento y entra de nuevo al checkout."
        );
      }

      let userData: Record<string, unknown>;
      if (request.guestCheckout) {
        if (!request.buyerEmail?.trim() || !request.metadata?.userName?.trim()) {
          throw new Error("Email y nombre completos son requeridos para compra sin cuenta");
        }
        userData = {
          name: request.metadata.userName.trim(),
          email: request.buyerEmail.trim(),
          displayName: request.metadata.userName.trim(),
          document: "12345678",
        };
        console.log("[createTicketPreference] Compra invitado:", request.buyerEmail);
      } else {
        console.log("[createTicketPreference] Leyendo usuario:", userId);
        const userDoc = await db.collection("users").doc(userId).get();
        if (!userDoc.exists) {
          throw new Error("Usuario no encontrado");
        }
        userData = userDoc.data()!;
        console.log("[createTicketPreference] Usuario OK");
      }

      await consumeReservation(db, reservationId, request);
      try {
        await assertEnoughCapacityForPurchase(
          db,
          request.eventId,
          eventData,
          request.quantity,
          request.metadata?.sectionId,
          request.metadata?.seatNumber
        );
      } catch (capErr) {
        await restoreReservationActive(db, reservationId, RESERVATION_HOLD_MS);
        throw capErr;
      }

      // Entrada gratuita: subtotal según precios del evento = 0
      const isFreeEvent = subtotalCOP === 0;

      if (isFreeEvent) {
        if (request.amount !== 0) {
          throw new Error(
            "Este evento es gratuito. Actualiza la página del checkout e intenta de nuevo."
          );
        }
        console.log(`Creating free ticket for event: ${request.eventId}`);

        // Crear ticket directamente como aprobado para entrada libre
        const ticketData: Omit<Ticket, "createdAt" | "updatedAt"> & {sectionId?: string; sectionName?: string} = {
          userId: request.userId,
          eventId: request.eventId,
          preferenceId: "free_event", // Identificador especial para entradas libres
          paymentId: `free_${Date.now()}`, // ID único para entradas libres
          paymentStatus: "approved",
          paymentMethod: "free",
          amount: 0,
          quantity: request.quantity,
          currency: "COP",
          ticketStatus: "paid",
          qrCode: "", // Se generará inmediatamente
          buyerEmail: request.buyerEmail,
          initPoint: "", // Se llenará después de crear el ticket
          sectionId: request.metadata?.sectionId,
          sectionName: request.metadata?.seatNumber || "",
          metadata: {
            userName: request.metadata?.userName ||
              (userData.name as string) ||
              (userData.displayName as string) ||
              (userData.email as string),
            eventName: request.metadata?.eventName ||
              eventData.title ||
              eventData.name,
            seatNumber: request.metadata?.seatNumber || "",
          },
        };

        let freeTicketId: string | undefined;
        try {
          freeTicketId = await this.ticketRepository.create(ticketData);

          const qrCode = await this.qrGenerator.generateQRCode(
            freeTicketId,
            this.config.appUrl
          );

          const doneParams = new URLSearchParams({
            event: String(eventData.slug || eventData.id),
            value: "0",
            name: String(eventData.name || ""),
            qty: String(request.quantity),
          });
          if (request.metadata?.seatNumber) {
            doneParams.set("section", request.metadata.seatNumber);
          }
          const initPoint = request.guestCheckout
            ? `${this.config.appUrl}/compra-finalizada?${doneParams.toString()}`
            : `${this.config.appUrl}/tickets`;

          await this.ticketRepository.update(freeTicketId, {
            qrCode: qrCode,
            initPoint: initPoint,
          });

          console.log(
            `Free ticket created and approved: ${freeTicketId} for user: ${userId}`
          );

          return {
            ticketId: freeTicketId,
            preferenceId: "free_event",
            initPoint: initPoint,
            sandboxInitPoint: initPoint,
          };
        } catch (freeErr) {
          if (freeTicketId) {
            await this.ticketRepository.delete(freeTicketId).catch(() => undefined);
          }
          await restoreReservationActive(db, reservationId, RESERVATION_HOLD_MS);
          throw freeErr;
        }
      }

      // Flujo normal: subtotal + tarifa (override evento → organizador → global)
      const organizerFee = await loadOrganizerBuyerFee(
        db,
        String(eventData.organizer_id || "")
      );
      const priced = expectedTotalCOP(
        subtotalCOP,
        request.quantity,
        eventData,
        globalFeesPercent,
        organizerFee
      );
      const finalAmount = priced.total;
      if (Math.abs(request.amount - finalAmount) > 2) {
        throw new Error(
          `El total no coincide con el precio vigente (${finalAmount} COP). Recarga el checkout e intenta de nuevo.`
        );
      }
      console.log("[createTicketPreference] Precios:", {
        subtotalCOP,
        feeCOP: priced.feeCOP,
        total: finalAmount,
        feeSource: priced.feeSource,
        clientAmount: request.amount,
      });

      if (finalAmount < this.config.minAmount) {
        throw new Error(`El monto mínimo es $${this.config.minAmount} COP`);
      }

      // Crear ticket con estado pendiente
      const ticketData: Omit<Ticket, "createdAt" | "updatedAt"> & {sectionId?: string; sectionName?: string} = {
        userId: request.userId,
        eventId: request.eventId,
        preferenceId: "", // Se llenará después de crear la preferencia
        paymentId: "",
        paymentStatus: "pending",
        paymentMethod: "",
        amount: finalAmount,
        quantity: request.quantity, // Cantidad de tickets/reservas
        currency: "COP",
        ticketStatus: "reserved",
        qrCode: "", // Se generará cuando se confirme el pago
        buyerEmail: request.buyerEmail,
        initPoint: "", // Se llenará después de crear la preferencia
        sectionId: request.metadata?.sectionId,
        sectionName: request.metadata?.seatNumber || "",
        metadata: {
          userName: request.metadata?.userName ||
            (userData.name as string) ||
            (userData.displayName as string) ||
            (userData.email as string),
          eventName: request.metadata?.eventName ||
            eventData.title ||
            eventData.name,
          seatNumber: request.metadata?.seatNumber || "",
        },
      };

      console.log("[createTicketPreference] Creando ticket en Firestore...");
      let paidTicketId: string;
      try {
        paidTicketId = await this.ticketRepository.create(ticketData);
      } catch (createErr) {
        await restoreReservationActive(db, reservationId, RESERVATION_HOLD_MS);
        throw createErr;
      }
      console.log("[createTicketPreference] Ticket creado:", paidTicketId);

      // Calcular precio unitario basado en cantidad (total incluye comisión)
      const unitPrice = Math.round(finalAmount / request.quantity);
      // Crear la preferencia en MercadoPago
      console.log("[createTicketPreference] Creando preferencia MercadoPago:", {quantity: request.quantity, unitPrice, amount: finalAmount});
      const preferenceData = {
        items: [
          {
            id: paidTicketId,
            title: `${this.config.isDevelopment ? "[DEV] " : ""}Ticket - ${
              eventData.title || eventData.name}`,
            description: `${this.config.isDevelopment ? "[DESARROLLO] " : ""}${request.quantity} entrada(s) para ${
              eventData.title || eventData.name}`,
            category_id: "tickets",
            quantity: request.quantity,
            currency_id: "COP",
            unit_price: unitPrice,
          },
        ],

        payer: {
          name: (userData.name as string) || (userData.displayName as string) || "",
          email: request.buyerEmail,
          identification: {
            type: "CC",
            number: (userData.document as string) || "12345678",
          },
        },

        back_urls: (() => {
          const base = `${this.config.appUrl}/compra-finalizada`;
          const q = new URLSearchParams({
            event: String(eventData.slug || eventData.id),
            value: String(finalAmount),
            name: String(eventData.name || ""),
            qty: String(request.quantity),
          });
          if (request.metadata?.seatNumber) {
            q.set("section", request.metadata.seatNumber);
          }
          const done = `${base}?${q.toString()}`;
          return {
            success: done,
            // Misma página que success/pending: MP añade status, payment_id, etc. por GET
            failure: done,
            pending: done,
          };
        })(),
        auto_return: "approved",

        external_reference: paidTicketId,

        payment_methods: {
          excluded_payment_methods: [],
          excluded_payment_types: [],
          installments: 12,
        },

        notification_url: "https://us-central1-ticket-colombia-e6267.cloudfunctions.net/mercadopagoWebhook",

        expires: true,
        expiration_date_from: new Date().toISOString(),
        expiration_date_to: new Date(Date.now() + 30 * 60 * 1000)
          .toISOString(), // 30 minutos
      };

      // Crear la preferencia
      let mpPreference;
      try {
        mpPreference = await this.paymentProvider.createPreference(preferenceData);
        console.log("[createTicketPreference] Preferencia MP creada:", mpPreference?.id);
      } catch (mpError) {
        const e = mpError as Error;
        console.error("[createTicketPreference] Error MercadoPago createPreference:", e.message, e.stack);
        await this.ticketRepository.delete(paidTicketId).catch(() => undefined);
        await restoreReservationActive(db, reservationId, RESERVATION_HOLD_MS);
        throw mpError;
      }

      try {
        await this.ticketRepository.update(paidTicketId, {
          preferenceId: mpPreference.id || "",
          initPoint: mpPreference.init_point || "",
        });
      } catch (updErr) {
        await this.ticketRepository.delete(paidTicketId).catch(() => undefined);
        await restoreReservationActive(db, reservationId, RESERVATION_HOLD_MS);
        throw updErr;
      }

      console.log(`Ticket created: ${paidTicketId} for user: ${userId}`);

      return {
        ticketId: paidTicketId,
        preferenceId: mpPreference.id,
        initPoint: mpPreference.init_point,
        sandboxInitPoint: mpPreference.sandbox_init_point,
      };
    } catch (error) {
      const e = error as Error;
      console.error("[createTicketPreference] Error en servicio:", e.message, e.stack);
      throw new Error(`Error al crear la preferencia de pago: ${e.message}`);
    }
  }

  /**
   * Procesa una notificación de webhook
   * @param {WebhookNotification} notification - Notificación del webhook
   * @param {Record<string, string>} headers - Headers de la petición
   */
  async processWebhookNotification(
    notification: WebhookNotification,
    headers: Record<string, string>
  ): Promise<void> {
    try {
      console.log("Processing webhook notification:", JSON.stringify(notification, null, 2));

      // Verificar si es una notificación de prueba
      if (!notification.live_mode && notification.data?.id === "123456") {
        console.log("Test webhook received - skipping processing");
        return;
      }

      // Validar firma de seguridad para notificaciones reales
      const xSignature = headers["x-signature"];
      const xRequestId = headers["x-request-id"];

      if (notification.live_mode && xSignature && xRequestId && notification.data?.id) {
        const isValidSignature = this.paymentProvider.validateWebhookSignature(
          xSignature,
          xRequestId,
          notification.data.id,
          this.config.webhookSecret
        );

        if (!isValidSignature) {
          throw new Error("Invalid webhook signature - possible security threat");
        }
        console.log("Webhook signature validated successfully");
      } else if (notification.live_mode) {
        console.warn("Missing signature headers in live mode webhook");
      }

      // Determinar el tipo de notificación y el ID del recurso
      let resourceType: string;
      let resourceId: string;

      if (notification.type && notification.data?.id) {
        // Formato Webhook estándar
        resourceType = notification.type;
        resourceId = notification.data.id;
      } else if (notification.topic && notification.resource) {
        // Formato IPN - extraer ID de la URL del recurso
        resourceType = notification.topic;
        const resourceUrl = notification.resource;
        const urlParts = resourceUrl.split("/");
        resourceId = urlParts[urlParts.length - 1];
      } else {
        console.error("Invalid notification format - missing required fields");
        return;
      }

      console.log(`Processing ${resourceType} notification for resource: ${resourceId}`);

      // Procesar según el tipo de recurso
      switch (resourceType) {
      case "payment": {
        // Validar que el paymentId sea válido
        if (!resourceId || resourceId === "123456") {
          console.log("Invalid or test payment ID, skipping processing");
          return;
        }

        // Obtener detalles del pago desde MercadoPago
        const paymentData = await this.paymentProvider.getPayment(resourceId);
        console.log("Payment data retrieved:", JSON.stringify(paymentData, null, 2));

        // El external_reference es nuestro ticketId
        const ticketId = paymentData.external_reference;

        if (!ticketId) {
          console.error("No external_reference found in payment");
          return;
        }

        // Actualizar el ticket
        await this.updateTicketFromPayment(ticketId, paymentData);
        console.log(`Successfully processed payment ${resourceId} for ticket ${ticketId}`);
        break;
      }

      case "merchant_order": {
        console.log("Merchant order notification received - processing...");

        // Obtener datos de la orden comercial
        const orderData = await this.paymentProvider.getMerchantOrder(resourceId);
        console.log("Merchant order data retrieved:", JSON.stringify(orderData, null, 2));

        // Procesar pagos asociados a la orden
        if (orderData.payments && orderData.payments.length > 0) {
          for (const payment of orderData.payments) {
            if (payment.status === "approved") {
              // Obtener detalles completos del pago
              const paymentData = await this.paymentProvider.getPayment(payment.id);

              if (paymentData.external_reference) {
                await this.updateTicketFromPayment(paymentData.external_reference, paymentData);
                console.log(`Processed payment ${payment.id} from merchant order ${resourceId}`);
              }
            }
          }
        } else {
          console.log(`No payments found in merchant order ${resourceId}`);
        }
        break;
      }

      default:
        console.log(`Unhandled webhook type: ${resourceType}`);
      }
    } catch (error) {
      console.error("Error processing webhook notification:", error);
      throw error;
    }
  }

  /**
   * Actualiza un ticket basado en los datos del pago
   * @param {string} ticketId - ID del ticket
   * @param {PaymentData} paymentData - Datos del pago
   */
  async updateTicketFromPayment(ticketId: string, paymentData: PaymentData): Promise<void> {
    try {
      // Verificar que el ticket existe
      const ticket = await this.ticketRepository.findById(ticketId);
      if (!ticket) {
        console.error(`Ticket not found: ${ticketId}`);
        return;
      }

      const updateData: Partial<Ticket> = {
        paymentId: paymentData.id,
        paymentStatus: paymentData.status,
        paymentMethod: paymentData.payment_method_id || "",
      };

      // Actualizar ticketStatus según el estado del pago
      switch (paymentData.status) {
      case "approved":
        updateData.ticketStatus = "paid";
        // Generar QR code
        updateData.qrCode = await this.qrGenerator.generateQRCode(ticketId, this.config.appUrl);
        // Actualizar initPoint para redirigir al ticket aprobado
        updateData.initPoint = `${this.config.appUrl}/tickets`;
        console.log(`Payment approved for ticket: ${ticketId}`);
        break;

      case "rejected":
        updateData.ticketStatus = "cancelled";
        console.log(`Payment rejected for ticket: ${ticketId}`);
        break;

      case "pending":
        updateData.ticketStatus = "reserved";
        console.log(`Payment pending for ticket: ${ticketId}`);
        break;

      default:
        console.log(`Unhandled payment status: ${paymentData.status}`);
      }

      // Actualizar el ticket
      await this.ticketRepository.update(ticketId, updateData);

      console.log(`Ticket ${ticketId} updated with payment status: ${paymentData.status}`);
    } catch (error) {
      console.error("Error updating ticket:", error);
      throw error;
    }
  }
}
