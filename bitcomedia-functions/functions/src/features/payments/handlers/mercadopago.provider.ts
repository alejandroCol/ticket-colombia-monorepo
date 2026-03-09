import {MercadoPagoConfig, Preference, Payment, MerchantOrder} from "mercadopago";
import * as crypto from "crypto";
import {PaymentProvider, PaymentData, MerchantOrderData} from "../types";

/**
 * Proveedor de pagos para MercadoPago
 */
export class MercadoPagoProvider implements PaymentProvider {
  private client: MercadoPagoConfig;
  private preference: Preference;
  private payment: Payment;
  private merchantOrder: MerchantOrder;

  /**
   * Constructor del proveedor de MercadoPago
   * @param {string} accessToken - Token de acceso de MercadoPago
   */
  constructor(accessToken: string) {
    this.client = new MercadoPagoConfig({
      accessToken: accessToken,
      options: {
        timeout: 5000,
      },
    });

    this.preference = new Preference(this.client);
    this.payment = new Payment(this.client);
    this.merchantOrder = new MerchantOrder(this.client);
  }

  /**
   * Crea una preferencia de pago en MercadoPago
   * @param {any} preferenceData - Datos de la preferencia
   * @return {Promise<any>} Respuesta de MercadoPago
   */
  async createPreference(preferenceData: any): Promise<any> {
    try {
      console.log("Creating MercadoPago preference:",
        JSON.stringify(preferenceData, null, 2));

      const mpPreference = await this.preference.create({body: preferenceData});

      console.log("MercadoPago preference created:", {
        id: mpPreference.id,
        init_point: mpPreference.init_point,
      });

      return mpPreference;
    } catch (error) {
      console.error("Error creating MercadoPago preference:", error);
      const errorMessage = `Failed to create payment preference: ${
        (error as Error).message}`;
      throw new Error(errorMessage);
    }
  }

  /**
   * Obtiene los datos de un pago desde MercadoPago
   * @param {string} paymentId - ID del pago
   * @return {Promise<PaymentData>} Datos del pago
   */
  async getPayment(paymentId: string): Promise<PaymentData> {
    try {
      console.log(`Fetching payment data for ID: ${paymentId}`);

      const paymentData = await this.payment.get({id: paymentId});

      console.log("Payment data retrieved:", {
        id: paymentData.id,
        status: paymentData.status,
        external_reference: paymentData.external_reference,
      });

      return {
        id: String(paymentData.id),
        status: paymentData.status as any,
        payment_method_id: paymentData.payment_method_id,
        external_reference: paymentData.external_reference,
        ...paymentData,
      } as PaymentData;
    } catch (error) {
      console.error(`Error fetching payment ${paymentId}:`, error);
      const errorMessage = `Failed to fetch payment data: ${
        (error as Error).message}`;
      throw new Error(errorMessage);
    }
  }

  /**
   * Obtiene los datos de una orden comercial desde MercadoPago
   * @param {string} orderId - ID de la orden comercial
   * @return {Promise<MerchantOrderData>} Datos de la orden comercial
   */
  async getMerchantOrder(orderId: string): Promise<MerchantOrderData> {
    try {
      console.log(`Fetching merchant order data for ID: ${orderId}`);

      const orderData = await this.merchantOrder.get({merchantOrderId: orderId});

      console.log("Merchant order data retrieved:", {
        id: orderData.id,
        status: orderData.status,
        external_reference: orderData.external_reference,
        payments: orderData.payments?.length || 0,
      });

      return {
        id: String(orderData.id),
        status: orderData.status || "",
        external_reference: orderData.external_reference,
        payments: orderData.payments?.map((payment: any) => ({
          id: String(payment.id),
          status: payment.status,
          transaction_amount: payment.transaction_amount,
        })) || [],
      } as MerchantOrderData;
    } catch (error) {
      console.error(`Error fetching merchant order ${orderId}:`, error);
      const errorMessage = `Failed to fetch merchant order data: ${
        (error as Error).message}`;
      throw new Error(errorMessage);
    }
  }

  /**
   * Valida la firma del webhook de MercadoPago
   * @param {string} signature - Header x-signature del webhook
   * @param {string} requestId - Header x-request-id del webhook
   * @param {string} dataId - ID del recurso notificado
   * @param {string} secret - Clave secreta del webhook
   * @return {boolean} True si la firma es válida
   */
  validateWebhookSignature(
    signature: string,
    requestId: string,
    dataId: string,
    secret: string
  ): boolean {
    try {
      // Crear el string para validar según documentación de MercadoPago
      const manifest = `id:${dataId};request-id:${requestId};`;

      // Generar HMAC SHA256
      const hmac = crypto.createHmac("sha256", secret);
      hmac.update(manifest);
      const sha = hmac.digest("hex");

      // Extraer la firma del header (formato: ts=timestamp,v1=signature)
      const signatureParts = signature.split(",");
      let extractedSignature = "";

      for (const part of signatureParts) {
        const [key, value] = part.split("=");
        if (key === "v1") {
          extractedSignature = value;
          break;
        }
      }

      console.log(`Validating signature for dataId: ${dataId}`);
      console.log(`Expected: ${sha}, Received: ${extractedSignature}`);

      return extractedSignature === sha;
    } catch (error) {
      console.error("Error validating webhook signature:", error);
      return false;
    }
  }
}
