/** Carga diferida del servicio de pagos y SDK de Mercado Pago (evita timeout en deploy). */

import type {PaymentConfig, PaymentService} from "./types";
import {FirestoreTicketRepository} from "./repositories/firestore-ticket.repository";

type PaymentServiceModule = typeof import("./services/payment.service");
type MercadoPagoProviderModule = typeof import("./handlers/mercadopago.provider");
type QrGeneratorModule = typeof import("./handlers/qr-generator");

let paymentServiceMod: PaymentServiceModule | undefined;
let mercadopagoProviderMod: MercadoPagoProviderModule | undefined;
let qrGeneratorMod: QrGeneratorModule | undefined;

function loadPaymentServiceModule(): PaymentServiceModule {
  if (!paymentServiceMod) {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    paymentServiceMod = require("./services/payment.service") as PaymentServiceModule;
  }
  return paymentServiceMod;
}

function loadMercadopagoProviderModule(): MercadoPagoProviderModule {
  if (!mercadopagoProviderMod) {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    mercadopagoProviderMod = require("./handlers/mercadopago.provider") as MercadoPagoProviderModule;
  }
  return mercadopagoProviderMod;
}

function loadQrGeneratorModule(): QrGeneratorModule {
  if (!qrGeneratorMod) {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    qrGeneratorMod = require("./handlers/qr-generator") as QrGeneratorModule;
  }
  return qrGeneratorMod;
}

/** Misma firma que `PaymentServiceFactory.createPaymentConfig` (sin dependencias pesadas). */
export function createPaymentConfig(
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
  return {
    accessToken,
    webhookSecret,
    appUrl,
    isDevelopment,
    minAmount: isDevelopment ? 100 : 1000,
    onepayApiKey: onepay?.apiKey,
    onepayWebhookSecret: onepay?.webhookSecret,
    onepayWebhookToken: onepay?.webhookToken,
    mercadopagoPublicKey,
  };
}

export function createPaymentService(config: PaymentConfig): PaymentService {
  const {MercadoPagoPaymentService} = loadPaymentServiceModule();
  const {MercadoPagoProvider} = loadMercadopagoProviderModule();
  const {SimpleQRCodeGenerator} = loadQrGeneratorModule();
  const ticketRepository = new FirestoreTicketRepository();
  const paymentProvider = new MercadoPagoProvider(config.accessToken);
  const qrGenerator = new SimpleQRCodeGenerator();
  return new MercadoPagoPaymentService(
    ticketRepository,
    paymentProvider,
    qrGenerator,
    config
  );
}
