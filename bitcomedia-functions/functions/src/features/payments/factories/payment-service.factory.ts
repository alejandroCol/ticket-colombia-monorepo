import {PaymentService, PaymentConfig} from "../types";
import {
  createPaymentConfig as buildPaymentConfig,
  createPaymentService as buildPaymentService,
} from "../lazy-payment-modules";

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
    return buildPaymentService(config);
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
    },
    mercadopagoPublicKey?: string
  ): PaymentConfig {
    return buildPaymentConfig(
      accessToken,
      webhookSecret,
      appUrl,
      isDevelopment,
      onepay,
      mercadopagoPublicKey
    );
  }
}
