import {PaymentService, PaymentConfig} from "../types";
import {
  MercadoPagoPaymentService,
} from "../services/payment.service";
import {
  FirestoreTicketRepository,
} from "../repositories/firestore-ticket.repository";
import {MercadoPagoProvider} from "../handlers/mercadopago.provider";
import {SimpleQRCodeGenerator} from "../handlers/qr-generator";

/**
 * Factory para crear instancias del servicio de pagos
 */
export class PaymentServiceFactory {
  /**
   * Crea una instancia del servicio de pagos con todas sus dependencias
   * @param {PaymentConfig} config - Configuración del servicio de pagos
   * @return {PaymentService} Instancia del servicio de pagos
   */
  static createPaymentService(config: PaymentConfig): PaymentService {
    // Crear dependencias
    const ticketRepository = new FirestoreTicketRepository();
    const paymentProvider = new MercadoPagoProvider(config.accessToken);
    const qrGenerator = new SimpleQRCodeGenerator();

    // Crear y retornar el servicio
    return new MercadoPagoPaymentService(
      ticketRepository,
      paymentProvider,
      qrGenerator,
      config
    );
  }

  /**
   * Crea la configuración de pagos desde variables de entorno/secretos
   * @param {string} accessToken - Token de acceso de MercadoPago
   * @param {string} webhookSecret - Secreto del webhook
   * @param {string} appUrl - URL de la aplicación
   * @param {boolean} isDevelopment - Si está en modo desarrollo
   * @return {PaymentConfig} Configuración de pagos
   */
  static createPaymentConfig(
    accessToken: string,
    webhookSecret: string,
    appUrl: string,
    isDevelopment = false,
    onepay?: {
      apiKey?: string;
      webhookSecret?: string;
      webhookToken?: string;
    }
  ): PaymentConfig {
    return {
      accessToken,
      webhookSecret,
      appUrl,
      isDevelopment,
      // $100 COP para desarrollo, $1000 para producción
      minAmount: isDevelopment ? 100 : 1000,
      onepayApiKey: onepay?.apiKey,
      onepayWebhookSecret: onepay?.webhookSecret,
      onepayWebhookToken: onepay?.webhookToken,
    };
  }
}
