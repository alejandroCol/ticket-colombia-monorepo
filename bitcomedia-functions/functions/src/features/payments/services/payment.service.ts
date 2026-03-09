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

      // Obtener datos del evento
      console.log("[createTicketPreference] Leyendo evento:", request.eventId);
      const eventDoc = await db.collection("events").doc(request.eventId).get();
      if (!eventDoc.exists) {
        throw new Error("Evento no encontrado");
      }
      const eventData = eventDoc.data()!;
      console.log("[createTicketPreference] Evento OK:", eventData?.name);

      // Obtener datos del usuario
      console.log("[createTicketPreference] Leyendo usuario:", userId);
      const userDoc = await db.collection("users").doc(userId).get();
      if (!userDoc.exists) {
        throw new Error("Usuario no encontrado");
      }
      const userData = userDoc.data()!;
      console.log("[createTicketPreference] Usuario OK");

      // Verificar si es entrada libre (precio = 0)
      const isFreeEvent = request.amount === 0;

      if (isFreeEvent) {
        console.log(`Creating free ticket for event: ${request.eventId}`);

        // Crear ticket directamente como aprobado para entrada libre
        const ticketData: Omit<Ticket, "createdAt" | "updatedAt"> = {
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
          metadata: {
            userName: request.metadata?.userName ||
              userData.name ||
              userData.displayName ||
              userData.email,
            eventName: request.metadata?.eventName ||
              eventData.title ||
              eventData.name,
            seatNumber: request.metadata?.seatNumber || "",
          },
        };

        const ticketId = await this.ticketRepository.create(ticketData);

        // Generar QR code inmediatamente para entrada libre
        const qrCode = await this.qrGenerator.generateQRCode(ticketId, this.config.appUrl);

        // Crear initPoint para entrada libre
        const initPoint = `${this.config.appUrl}/tickets`;

        // Actualizar el ticket con el QR code y initPoint
        await this.ticketRepository.update(ticketId, {
          qrCode: qrCode,
          initPoint: initPoint,
        });

        console.log(`Free ticket created and approved: ${ticketId} for user: ${userId}`);

        // Retornar respuesta especial para entradas libres
        return {
          ticketId: ticketId,
          preferenceId: "free_event",
          initPoint: initPoint, // Redirigir directamente al ticket
          sandboxInitPoint: initPoint,
        };
      }

      // Flujo normal para eventos de pago
      // Validar monto mínimo solo para eventos de pago
      if (request.amount < this.config.minAmount) {
        throw new Error(`El monto mínimo es $${this.config.minAmount} COP`);
      }

      // Crear ticket con estado pendiente
      const ticketData: Omit<Ticket, "createdAt" | "updatedAt"> = {
        userId: request.userId,
        eventId: request.eventId,
        preferenceId: "", // Se llenará después de crear la preferencia
        paymentId: "",
        paymentStatus: "pending",
        paymentMethod: "",
        amount: request.amount,
        quantity: request.quantity, // Cantidad de tickets/reservas
        currency: "COP",
        ticketStatus: "reserved",
        qrCode: "", // Se generará cuando se confirme el pago
        buyerEmail: request.buyerEmail,
        initPoint: "", // Se llenará después de crear la preferencia
        metadata: {
          userName: request.metadata?.userName ||
            userData.name ||
            userData.displayName ||
            userData.email,
          eventName: request.metadata?.eventName ||
            eventData.title ||
            eventData.name,
          seatNumber: request.metadata?.seatNumber || "",
        },
      };

      console.log("[createTicketPreference] Creando ticket en Firestore...");
      const ticketId = await this.ticketRepository.create(ticketData);
      console.log("[createTicketPreference] Ticket creado:", ticketId);

      // Calcular precio unitario basado en cantidad
      const unitPrice = Math.round(request.amount / request.quantity);
      // Crear la preferencia en MercadoPago
      console.log("[createTicketPreference] Creando preferencia MercadoPago:", {quantity: request.quantity, unitPrice, amount: request.amount});
      const preferenceData = {
        items: [
          {
            id: ticketId,
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
          name: userData.name || userData.displayName || "",
          email: request.buyerEmail,
          identification: {
            type: "CC",
            number: userData.document || "12345678",
          },
        },

        back_urls: {
          success: `${this.config.appUrl}/compra-finalizada?event=${eventData.slug || eventData.id}&value=${request.amount}`,
          failure: `${this.config.appUrl}/tickets`,
          pending: `${this.config.appUrl}/compra-finalizada?event=${eventData.slug || eventData.id}&value=${request.amount}`,
        },
        auto_return: "approved",

        external_reference: ticketId,

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
        throw mpError;
      }

      // Actualizar el ticket con el preferenceId e initPoint
      await this.ticketRepository.update(ticketId, {
        preferenceId: mpPreference.id || "",
        initPoint: mpPreference.init_point || "",
      });

      console.log(`Ticket created: ${ticketId} for user: ${userId}`);

      return {
        ticketId: ticketId,
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
