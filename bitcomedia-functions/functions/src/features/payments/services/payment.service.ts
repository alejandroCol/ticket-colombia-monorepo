import * as admin from "firebase-admin";
import type {DocumentData} from "firebase-admin/firestore";
import {randomUUID} from "crypto";
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
  MercadoPagoCardPaymentRequest,
} from "../types";
import {finalizePaidTicketsWithBundle} from "../bundle-issuance";
import {sendAbonoDepositConfirmedEmail} from "../abono-email";
import {sendTicketEmail} from "../../manual-ticket/email-sender";
import {generateMultipleTicketsPdf} from "../../manual-ticket/pdf-generator-multiple";
import QRCode from "qrcode";
import {
  loadAbonoConfigFromEvent,
  computeDepositAndBalance,
  computeBalanceDueAtMs,
  canOfferAbonoNewPurchase,
} from "../abono-compute";
import {consumeReservation, restoreReservationActive} from "../../reservations/consume-reservation";
import {
  assertEnoughCapacityForPurchase,
  capacityBucketAndCount,
} from "../../reservations/availability";
import {
  expectedTotalCOP,
  buyerFeeFixedUnitCountFromRequest,
  unitPriceFromEventData,
  ticketLineSubtotalCOP,
  type OrganizerBuyerFeeInput,
} from "../pricing-from-event";
import {MercadoPagoProvider} from "../handlers/mercadopago.provider";
import {paymentProviderFromEventData} from "../payment-provider";
import {
  onepayCreatePayment,
  onepayGetPayment,
  verifyOnePayWebhookSignatureDetailed,
  mapOnePayPaymentStatusToInternal,
  onepayAmountToNumber,
  onepayPickExternalId,
  ticketIdFromOnePayMetadata,
  normalizeOnePayWebhookPayload,
  normalizeOnePaySecretValue,
  collectOnePaySignatureHeader,
  onePayWebhookInterestingHeaderKeys,
  type OnePayWebhookPayload,
} from "../handlers/onepay.api";

const RESERVATION_HOLD_MS = 10 * 60 * 1000;

/**
 * URL de `mercadopagoWebhook` para Checkout Pro. Si queda fija a otro proyecto, MP aprueba el pago
 * pero tu backend nunca actualiza el ticket.
 */
function mercadopagoNotificationUrl(): string {
  const explicit =
    process.env.MERCADOPAGO_NOTIFICATION_URL?.trim() ||
    process.env.MERCADOPAGO_WEBHOOK_URL?.trim();
  if (explicit) return explicit;
  const project =
    process.env.GCLOUD_PROJECT?.trim() ||
    process.env.GCP_PROJECT?.trim() ||
    "";
  const region = process.env.FUNCTION_REGION?.trim() || "us-central1";
  if (project) {
    return `https://${region}-${project}.cloudfunctions.net/mercadopagoWebhook`;
  }
  console.warn(
    "[MP] Sin MERCADOPAGO_NOTIFICATION_URL ni GCLOUD_PROJECT; usando URL heredada (puede ser incorrecta)"
  );
  return "https://us-central1-ticket-colombia-e6267.cloudfunctions.net/mercadopagoWebhook";
}

function localityNameFromRequest(request: CreateTicketRequest): string {
  return (request.metadata?.seatNumber || "General").trim() || "General";
}

/**
 * Si el cliente envió mapZoneId pero no etiqueta (enlaces viejos o bugs), se toma
 * label / palco_index del venue_map para mostrar ej. "Palcos 3" en QR y PDF.
 */
function ensureMapZoneLabelFromVenueMap(
  eventData: DocumentData,
  request: CreateTicketRequest
): void {
  const mz = String(request.metadata?.mapZoneId || "").trim();
  if (!mz) return;
  const existing = String(request.metadata?.mapZoneLabel || "").trim();
  if (existing) return;
  const raw = eventData.venue_map as
    | {zones?: Array<{id?: string; label?: string; palco_index?: number}>}
    | undefined;
  const z = raw?.zones?.find((x) => String(x?.id || "").trim() === mz);
  if (!z) return;
  const derived =
    String(z.label || "").trim() ||
    (z.palco_index != null ? String(z.palco_index) : "");
  if (!derived) return;
  request.metadata = {...(request.metadata || {}), mapZoneLabel: derived};
}

/** Texto para el comprador (localidad + número de palco si aplica). */
function ticketSeatDisplayFromRequest(request: CreateTicketRequest): string {
  const loc = localityNameFromRequest(request);
  const lbl = (request.metadata?.mapZoneLabel || "").trim();
  return lbl ? `${loc} ${lbl}` : loc;
}

function buyerIdNumberForTicketMetadata(
  request: CreateTicketRequest,
  userData: Record<string, unknown>
): string | undefined {
  const fromMeta = String(request.metadata?.buyerIdNumber ?? "").trim();
  if (fromMeta) return fromMeta;
  const fromUser = String(
    (userData as {document?: unknown}).document ?? ""
  ).trim();
  return fromUser || undefined;
}

function sectionPurchaseMeta(
  eventData: DocumentData,
  sectionId?: string
): { seatsPerUnit: number; abonoAllowed: boolean } {
  const sections = eventData.sections as
    | Array<{ id: string; seats_per_unit?: number; abono_allowed?: boolean }>
    | undefined;
  if (!sectionId?.trim() || !sections?.length) {
    return {seatsPerUnit: 1, abonoAllowed: false};
  }
  const sec = sections.find((s) => s.id === sectionId);
  if (!sec) return {seatsPerUnit: 1, abonoAllowed: false};
  return {
    seatsPerUnit: Math.max(1, Number(sec.seats_per_unit) || 1),
    abonoAllowed: sec.abono_allowed === true,
  };
}

function mpPaidCOP(paymentData: PaymentData): number {
  const tx = (paymentData as { transaction_amount?: number }).transaction_amount;
  if (tx !== undefined && tx !== null) {
    return Math.round(Number(tx) || 0);
  }
  const am = (paymentData as { amount?: number }).amount;
  return Math.round(Number(am) || 0);
}

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
  return {type: t, value: v};
}

async function loadOrganizerSellerAccessToken(
  db: admin.firestore.Firestore,
  organizerId: string
): Promise<string | null> {
  const id = String(organizerId || "").trim();
  if (!id) return null;
  const snap = await db.collection("organizer_mp_seller").doc(id).get();
  if (!snap.exists) return null;
  const t = String(snap.data()?.access_token || "").trim();
  return t || null;
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

  /** Cliente MP para Checkout Pro: token del vendedor (split) o credencial de la plataforma. */
  private mpPreferenceClient(sellerAccessToken: string | null): MercadoPagoProvider {
    const t = String(sellerAccessToken || "").trim();
    if (t) return new MercadoPagoProvider(t);
    return this.paymentProvider as MercadoPagoProvider;
  }

  /**
   * Checkout Pro: redirección a Mercado Pago con todos los medios habilitados en la cuenta.
   */
  private async createCheckoutProPreference(params: {
    amountCOP: number;
    ticketId: string;
    payerEmail: string;
    itemTitle: string;
    itemDesc: string;
    successUrl: string;
    eventId: string;
    sellerAccessToken: string | null;
    marketplaceFeeCOP: number;
  }): Promise<{id: string; initPoint: string; sandboxInitPoint: string}> {
    const {
      amountCOP,
      ticketId,
      payerEmail,
      itemTitle,
      itemDesc,
      successUrl,
      eventId,
      sellerAccessToken,
      marketplaceFeeCOP,
    } = params;
    const amount = Math.round(amountCOP);
    if (amount < 1) {
      throw new Error("Monto de preferencia inválido");
    }
    const body: Record<string, unknown> = {
      items: [
        {
          title: itemTitle.slice(0, 256),
          description: itemDesc.slice(0, 256),
          quantity: 1,
          unit_price: amount,
          currency_id: "COP",
        },
      ],
      payer: {email: payerEmail},
      back_urls: {
        success: successUrl,
        failure: successUrl,
        pending: successUrl,
      },
      auto_return: "approved",
      external_reference: ticketId,
      notification_url: mercadopagoNotificationUrl(),
      metadata: {
        ticket_id: ticketId,
        event_id: eventId,
      },
    };
    const fee = Math.round(marketplaceFeeCOP);
    if (fee > 0 && sellerAccessToken) {
      body.marketplace_fee = Math.min(fee, Math.max(0, amount - 1));
    }
    const client = this.mpPreferenceClient(sellerAccessToken);
    const pref = await client.createPreference(body);
    const id = String((pref as {id?: unknown})?.id ?? "").trim();
    const initPoint = String((pref as {init_point?: unknown})?.init_point ?? "").trim();
    const sandboxInitPoint = String(
      (pref as {sandbox_init_point?: unknown})?.sandbox_init_point ?? ""
    ).trim();
    if (!id || !initPoint) {
      throw new Error("Mercado Pago no devolvió id de preferencia o init_point");
    }
    return {
      id,
      initPoint,
      sandboxInitPoint: sandboxInitPoint || initPoint,
    };
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
      ensureMapZoneLabelFromVenueMap(eventData, request);

      const payCfgSnap = await db.collection("configurations").doc("payments_config").get();
      const rawGlobalFees = payCfgSnap.exists ?
        Number(payCfgSnap.data()?.fees) :
        9;
      const globalFeesPercent = Number.isFinite(rawGlobalFees) ? rawGlobalFees : 9;

      const paymentProvider = paymentProviderFromEventData(eventData);
      console.log("[createTicketPreference] Pasarela por evento:", {
        eventId: request.eventId,
        paymentProvider,
      });

      const unitPriceCOP = unitPriceFromEventData(
        eventData,
        request.metadata?.sectionId
      );
      const subtotalCOP = ticketLineSubtotalCOP(
        eventData,
        request.metadata?.sectionId,
        request.metadata?.mapZoneId,
        unitPriceCOP,
        request.quantity
      );

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
        const guestDocDigits = String(
          request.metadata?.buyerIdNumber ?? ""
        ).replace(/\D/g, "");
        if (guestDocDigits.length < 6 || guestDocDigits.length > 12) {
          throw new Error(
            "Cédula o documento inválido para compra sin cuenta"
          );
        }
        const guestPhone = String(request.metadata?.buyerPhone ?? "").trim();
        if (!/^\+[1-9]\d{6,14}$/.test(guestPhone)) {
          throw new Error("Teléfono inválido para compra sin cuenta");
        }
        if (guestPhone.startsWith("+57")) {
          const n = guestPhone.replace(/\D/g, "");
          if (n.length !== 12) {
            throw new Error(
              "Teléfono colombiano: debe tener 10 dígitos además del +57"
            );
          }
        }
        userData = {
          name: request.metadata.userName.trim(),
          email: request.buyerEmail.trim(),
          displayName: request.metadata.userName.trim(),
          document: guestDocDigits,
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
          request.metadata?.seatNumber,
          request.metadata?.mapZoneId
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

        const {seatsPerUnit: spuFree} = sectionPurchaseMeta(
          eventData,
          request.metadata?.sectionId
        );

        // Crear ticket directamente como aprobado para entrada libre
        const mzFree = String(request.metadata?.mapZoneId || "").trim();
        const buyerIdNumMeta = buyerIdNumberForTicketMetadata(request, userData);
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
          qrCode: "",
          buyerEmail: request.buyerEmail,
          initPoint: "",
          sectionId: request.metadata?.sectionId,
          sectionName: localityNameFromRequest(request),
          mapZoneId: mzFree,
          ticketKind: "standard",
          transferredTo: null,
          ...capacityBucketAndCount({
            mapZoneId: mzFree,
            sectionId: request.metadata?.sectionId ?? null,
            sectionName: localityNameFromRequest(request),
            quantity: request.quantity,
            ticketKind: "standard",
          }),
          seatsPerUnit: spuFree,
          metadata: {
            userName: request.metadata?.userName ||
              (userData.name as string) ||
              (userData.displayName as string) ||
              (userData.email as string),
            eventName: request.metadata?.eventName ||
              eventData.title ||
              eventData.name,
            seatNumber: ticketSeatDisplayFromRequest(request),
            ...(buyerIdNumMeta ? {buyerIdNumber: buyerIdNumMeta} : {}),
            ...(String(request.metadata?.buyerPhone ?? "").trim() ?
              {buyerPhone: String(request.metadata?.buyerPhone).trim()} :
              {}),
          },
        };

        let freeTicketId: string | undefined;
        try {
          freeTicketId = await this.ticketRepository.create(ticketData);

          const doneParams = new URLSearchParams({
            event: String(eventData.slug || eventData.id),
            value: "0",
            name: String(eventData.name || ""),
            qty: String(request.quantity),
          });
          if (request.metadata?.seatNumber) {
            doneParams.set("section", request.metadata.seatNumber);
          }
          const initPoint = request.guestCheckout ?
            `${this.config.appUrl}/compra-finalizada?${doneParams.toString()}` :
            `${this.config.appUrl}/tickets`;

          const snapFree = await db.collection("tickets").doc(freeTicketId).get();
          await finalizePaidTicketsWithBundle(
            db,
            freeTicketId,
            {...(snapFree.data() || {})},
            this.qrGenerator,
            this.config.appUrl,
            this.ticketRepository
          );
          await this.ticketRepository.update(freeTicketId, {initPoint});

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
      const feeFixedUnits = buyerFeeFixedUnitCountFromRequest(
        request.quantity,
        eventData,
        request.metadata?.sectionId,
        request.metadata?.mapZoneId
      );
      const priced = expectedTotalCOP(
        subtotalCOP,
        request.quantity,
        eventData,
        globalFeesPercent,
        organizerFee,
        feeFixedUnits
      );
      const {seatsPerUnit, abonoAllowed} = sectionPurchaseMeta(
        eventData,
        request.metadata?.sectionId
      );
      const wantsDeposit = request.paymentMode === "deposit";
      const paymentMode =
        wantsDeposit && abonoAllowed && !request.guestCheckout ? "deposit" : "full";

      if (wantsDeposit && paymentMode !== "deposit") {
        throw new Error(
          "Para pagar con abono debes iniciar sesión y elegir una localidad que permita abono."
        );
      }

      let chargeAmount = priced.total;
      let depositCOP = 0;
      let balanceCOP = 0;
      let balanceDueAt: admin.firestore.Timestamp | undefined;
      let abonoToken: string | undefined;
      let installmentPhase: Ticket["installmentPhase"] = "none";

      if (paymentMode === "deposit") {
        const abonoCfg = loadAbonoConfigFromEvent(eventData);
        const dueMs = computeBalanceDueAtMs(eventData, abonoCfg);
        if (!canOfferAbonoNewPurchase(dueMs)) {
          throw new Error(
            "Ya no es posible iniciar una compra con abono para este evento (plazo límite vencido)."
          );
        }
        const split = computeDepositAndBalance(priced.total, abonoCfg);
        depositCOP = split.depositCOP;
        balanceCOP = split.balanceCOP;
        chargeAmount = depositCOP;
        if (Math.abs(request.amount - chargeAmount) > 2) {
          throw new Error(
            `El monto del abono no coincide (${chargeAmount} COP). Recarga el checkout e intenta de nuevo.`
          );
        }
        balanceDueAt = admin.firestore.Timestamp.fromMillis(dueMs!);
        abonoToken = randomUUID().replace(/-/g, "");
        installmentPhase = "awaiting_deposit";
      } else if (Math.abs(request.amount - priced.total) > 2) {
        throw new Error(
          `El total no coincide con el precio vigente (${priced.total} COP). Recarga el checkout e intenta de nuevo.`
        );
      }

      console.log("[createTicketPreference] Precios:", {
        subtotalCOP,
        feeCOP: priced.feeCOP,
        total: priced.total,
        chargeAmount,
        paymentMode,
        feeSource: priced.feeSource,
        clientAmount: request.amount,
      });

      if (chargeAmount < this.config.minAmount) {
        throw new Error(`El monto mínimo es $${this.config.minAmount} COP`);
      }

      const organizerUid = String(eventData.organizer_id || "").trim();
      const sellerAccessToken = await loadOrganizerSellerAccessToken(db, organizerUid);
      let marketplaceFeeCOP = 0;
      if (sellerAccessToken && priced.feeCOP > 0) {
        const rawFee = Math.round(priced.feeCOP);
        marketplaceFeeCOP = Math.min(
          Math.max(0, rawFee),
          Math.max(0, chargeAmount - 1)
        );
      }
      console.log("[createTicketPreference] MP marketplace:", {
        organizerUid: organizerUid || null,
        hasSellerToken: Boolean(sellerAccessToken),
        marketplaceFeeCOP,
      });

      // Crear ticket con estado pendiente
      const mzPaid = String(request.metadata?.mapZoneId || "").trim();
      const buyerIdNumPaid = buyerIdNumberForTicketMetadata(request, userData);
      const ticketData: Omit<Ticket, "createdAt" | "updatedAt"> & {sectionId?: string; sectionName?: string} = {
        userId: request.userId,
        eventId: request.eventId,
        preferenceId: "", // Se llenará después de crear la preferencia
        paymentId: "",
        paymentStatus: "pending",
        paymentMethod: "",
        amount: priced.total,
        quantity: request.quantity,
        currency: "COP",
        ticketStatus: "reserved",
        qrCode: "", // Se generará cuando se confirme el pago completo
        buyerEmail: request.buyerEmail,
        initPoint: "", // Se llenará después de crear la preferencia
        sectionId: request.metadata?.sectionId,
        sectionName: localityNameFromRequest(request),
        mapZoneId: mzPaid,
        ticketKind: "standard",
        transferredTo: null,
        ...capacityBucketAndCount({
          mapZoneId: mzPaid,
          sectionId: request.metadata?.sectionId ?? null,
          sectionName: localityNameFromRequest(request),
          quantity: request.quantity,
          ticketKind: "standard",
        }),
        seatsPerUnit,
        installmentPhase,
        ...(paymentMode === "deposit" && balanceDueAt && abonoToken ?
          {
            totalPurchaseCOP: priced.total,
            depositCOP,
            balanceCOP,
            balanceDueAt,
            abonoCompletionToken: abonoToken,
          } :
          {}),
        metadata: {
          userName: request.metadata?.userName ||
            (userData.name as string) ||
            (userData.displayName as string) ||
            (userData.email as string),
          eventName: request.metadata?.eventName ||
            eventData.title ||
            eventData.name,
          seatNumber: ticketSeatDisplayFromRequest(request),
          ...(buyerIdNumPaid ? {buyerIdNumber: buyerIdNumPaid} : {}),
          ...(String(request.metadata?.buyerPhone ?? "").trim() ?
            {buyerPhone: String(request.metadata?.buyerPhone).trim()} :
            {}),
        },
        ...(organizerUid && sellerAccessToken ?
          {mpSplitOrganizerId: organizerUid} :
          {}),
        ...(marketplaceFeeCOP > 0 ? {mpMarketplaceFeeCOP: marketplaceFeeCOP} : {}),
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

      const itemTitle =
        paymentMode === "deposit" ?
          `${this.config.isDevelopment ? "[DEV] " : ""}Abono · ${
            eventData.title || eventData.name}` :
          `${this.config.isDevelopment ? "[DEV] " : ""}Ticket - ${
            eventData.title || eventData.name}`;
      const itemDesc =
        paymentMode === "deposit" ?
          `Abono (${request.quantity} uds.) — ${eventData.title || eventData.name}` :
          `${request.quantity} entrada(s) para ${eventData.title || eventData.name}`;

      const compraFinalizadaUrl = (() => {
        const base = `${this.config.appUrl}/compra-finalizada`;
        const q = new URLSearchParams({
          event: String(eventData.slug || eventData.id),
          value: String(chargeAmount),
          name: String(eventData.name || ""),
          qty: String(request.quantity),
        });
        if (request.metadata?.seatNumber) {
          q.set("section", request.metadata.seatNumber);
        }
        if (paymentMode === "deposit") {
          q.set("abono", "1");
        }
        return `${base}?${q.toString()}`;
      })();

      if (paymentProvider === "onepay") {
        const apiKey = this.config.onepayApiKey?.trim();
        if (!apiKey) {
          await this.ticketRepository.delete(paidTicketId).catch(() => undefined);
          await restoreReservationActive(db, reservationId, RESERVATION_HOLD_MS);
          throw new Error("OnePay no está configurado (ONEPAY_API_KEY)");
        }
        console.log("[createTicketPreference] Creando cobro OnePay", {
          chargeAmount,
          paymentMode,
        });
        let onePayLink = "";
        let onePayId = "";
        try {
          const created = await onepayCreatePayment({
            apiKey,
            amount: chargeAmount,
            title: itemTitle,
            email: request.buyerEmail,
            externalId: paidTicketId,
            reference: paidTicketId,
            redirectUrl: compraFinalizadaUrl,
            idempotencyKey: paidTicketId,
            description: `${this.config.isDevelopment ? "[DESARROLLO] " : ""}${itemDesc}`,
            metadataPairs: [
              {key: "eventId", value: request.eventId},
              {key: "ticketId", value: paidTicketId},
            ],
          });
          onePayLink = (created.payment_link || "").trim();
          onePayId = (created.id || "").trim();
          if (!onePayId || !onePayLink) {
            throw new Error("OnePay no devolvió id o payment_link");
          }
          await this.ticketRepository.update(paidTicketId, {
            preferenceId: onePayId,
            initPoint: onePayLink,
          });
        } catch (onePayErr) {
          console.error("[createTicketPreference] OnePay:", onePayErr);
          await this.ticketRepository.delete(paidTicketId).catch(() => undefined);
          await restoreReservationActive(db, reservationId, RESERVATION_HOLD_MS);
          throw onePayErr;
        }
        console.log(`Ticket created (OnePay): ${paidTicketId} for user: ${userId}`);
        return {
          ticketId: paidTicketId,
          preferenceId: onePayId,
          initPoint: onePayLink,
          sandboxInitPoint: onePayLink,
        };
      }

      console.log("[createTicketPreference] Checkout Pro Mercado Pago:", {
        amount: chargeAmount,
        paymentMode,
      });
      try {
        const created = await this.createCheckoutProPreference({
          amountCOP: chargeAmount,
          ticketId: paidTicketId,
          payerEmail: request.buyerEmail,
          itemTitle,
          itemDesc,
          successUrl: compraFinalizadaUrl,
          eventId: request.eventId,
          sellerAccessToken,
          marketplaceFeeCOP,
        });
        await this.ticketRepository.update(paidTicketId, {
          preferenceId: created.id,
          initPoint: created.initPoint,
        });
        console.log(
          `[createTicketPreference] Checkout Pro OK ticket=${paidTicketId} pref=${created.id}`
        );
        return {
          ticketId: paidTicketId,
          preferenceId: created.id,
          initPoint: created.initPoint,
          sandboxInitPoint: created.sandboxInitPoint,
        };
      } catch (mpErr) {
        console.error("[createTicketPreference] Mercado Pago Checkout Pro:", mpErr);
        await this.ticketRepository.delete(paidTicketId).catch(() => undefined);
        await restoreReservationActive(db, reservationId, RESERVATION_HOLD_MS);
        throw mpErr;
      }
    } catch (error) {
      const e = error as Error;
      console.error("[createTicketPreference] Error en servicio:", e.message, e.stack);
      throw new Error(`Error al crear la preferencia de pago: ${e.message}`);
    }
  }

  /**
   * API de Pagos: cobro con token de tarjeta (Brick en el cliente).
   */
  async createMercadoPagoCardPayment(
    request: MercadoPagoCardPaymentRequest,
    userId: string | undefined,
    guestEmail?: string
  ): Promise<{
    status: string;
    paymentId?: string;
    statusDetail?: string;
  }> {
    const ticketId = String(request.ticketId || "").trim();
    const token = String(request.token || "").trim();
    const paymentMethodId = String(request.paymentMethodId || "").trim();
    if (!ticketId || !token || !paymentMethodId) {
      throw new Error("Faltan ticketId, token o paymentMethodId");
    }

    const guestFromReq = String(request.guestEmail || guestEmail || "").trim();

    const ticket = await this.ticketRepository.findById(ticketId);
    if (!ticket) {
      throw new Error("Ticket no encontrado");
    }
    if (String(ticket.userId || "").startsWith("guest_")) {
      const em = guestFromReq.toLowerCase();
      const expected = String(ticket.buyerEmail || "").toLowerCase();
      if (!em || em !== expected) {
        throw new Error("Indica el mismo correo que usaste en el checkout (compra sin cuenta).");
      }
    } else {
      if (!userId || ticket.userId !== userId) {
        throw new Error("Este ticket no pertenece a tu cuenta");
      }
    }

    const phase = ticket.installmentPhase || "none";
    let chargeAmount = 0;
    if (phase === "awaiting_deposit") {
      chargeAmount = Math.round(Number(ticket.depositCOP) || 0);
    } else if (phase === "awaiting_balance") {
      chargeAmount = Math.round(Number(ticket.balanceCOP) || 0);
    } else {
      chargeAmount = Math.round(Number(ticket.amount) || 0);
    }

    if (chargeAmount < this.config.minAmount) {
      throw new Error(`Monto inválido (${chargeAmount} COP)`);
    }

    const db = admin.firestore();
    let eventDoc = await db.collection("events").doc(ticket.eventId).get();
    if (!eventDoc.exists) {
      eventDoc = await db.collection("recurring_events").doc(ticket.eventId).get();
    }
    if (!eventDoc.exists) {
      throw new Error("Evento no encontrado");
    }
    const eventData = eventDoc.data()!;
    if (paymentProviderFromEventData(eventData) !== "mercadopago") {
      throw new Error("Este evento usa OnePay; el pago con tarjeta (Mercado Pago) no aplica.");
    }

    const organizerUid = String(eventData.organizer_id || "").trim();
    const sellerAccessToken = await loadOrganizerSellerAccessToken(db, organizerUid);
    const mpProvider = sellerAccessToken ?
      new MercadoPagoProvider(sellerAccessToken) :
      this.paymentProvider;

    let applicationFee = 0;
    if (
      phase !== "awaiting_balance" &&
      sellerAccessToken &&
      ticket.mpMarketplaceFeeCOP &&
      ticket.mpMarketplaceFeeCOP > 0
    ) {
      applicationFee = Math.min(
        Math.round(ticket.mpMarketplaceFeeCOP),
        Math.max(0, chargeAmount - 1)
      );
    }

    const idNum =
      String(ticket.metadata?.buyerIdNumber || "1234567890").replace(/\D/g, "") ||
      "1234567890";

    const body: Record<string, unknown> = {
      transaction_amount: chargeAmount,
      token,
      description: `${this.config.isDevelopment ? "[DEV] " : ""}${
        ticket.metadata?.eventName || "Ticket Colombia"
      }`,
      installments: Math.min(48, Math.max(1, Number(request.installments) || 1)),
      payment_method_id: paymentMethodId,
      payer: {
        email: ticket.buyerEmail,
        identification: {type: "CC", number: idNum.slice(0, 20)},
      },
      external_reference: ticketId,
      metadata: {ticket_id: ticketId},
      notification_url: mercadopagoNotificationUrl(),
    };

    const issuer = String(request.issuerId || "").trim();
    if (issuer) {
      body.issuer_id = issuer;
    }

    if (applicationFee > 0) {
      body.application_fee = applicationFee;
    }

    let createdRaw: {id?: string | number; status?: string; status_detail?: string};
    try {
      createdRaw = (await mpProvider.createPayment(body)) as {
        id?: string | number;
        status?: string;
        status_detail?: string;
      };
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      console.error("[createMercadoPagoCardPayment] createPayment:", msg);
      throw new Error(msg);
    }

    const paymentId =
      createdRaw?.id !== undefined && createdRaw?.id !== null ?
        String(createdRaw.id) :
        "";
    if (!paymentId) {
      throw new Error("Mercado Pago no devolvió id de pago");
    }

    const fullPayment = await mpProvider.getPayment(paymentId);
    await this.updateTicketFromPayment(ticketId, fullPayment);

    return {
      status: String(fullPayment.status || createdRaw.status || ""),
      paymentId,
      statusDetail: createdRaw.status_detail ?
        String(createdRaw.status_detail) :
        undefined,
    };
  }

  /**
   * Consulta un pago en MP: primero con el token de la plataforma; si falla, con tokens de vendedores (split).
   * @param {string} paymentId ID del pago Mercado Pago
   * @return {Promise<PaymentData>} Datos del pago
   */
  private async getPaymentForWebhook(paymentId: string): Promise<PaymentData> {
    try {
      return await this.paymentProvider.getPayment(paymentId);
    } catch (primaryErr) {
      console.warn(
        "[webhook] getPayment con token plataforma falló; probando organizadores",
        (primaryErr as Error)?.message
      );
      const db = admin.firestore();
      const snap = await db.collection("organizer_mp_seller").get();
      let lastErr: unknown = primaryErr;
      for (const doc of snap.docs) {
        const token = String(doc.data()?.access_token || "").trim();
        if (!token) continue;
        try {
          const p = new MercadoPagoProvider(token);
          return await p.getPayment(paymentId);
        } catch (e) {
          lastErr = e;
        }
      }
      throw lastErr instanceof Error ? lastErr : new Error(String(lastErr));
    }
  }

  /**
   * Webhook OnePay (`payment.*`) — https://docs.onepay.la/client/webhooks/ejemplos
   * @param {OnePayWebhookPayload} payload Cuerpo JSON del webhook
   * @param {string} rawBody Mismo body en string (firma HMAC)
   * @param {Record<string, string>} headers Cabeceras HTTP (minúsculas donde aplica)
   */
  async processOnePayWebhook(
    payload: OnePayWebhookPayload,
    rawBody: string,
    headers: Record<string, string>,
    parsedBodyForSignature?: unknown
  ): Promise<void> {
    const headersNorm: Record<string, string> = {};
    for (const [k, v] of Object.entries(headers || {})) {
      if (v === undefined || v === null) continue;
      const val = Array.isArray(v) ? v[0] : v;
      headersNorm[String(k).toLowerCase()] = String(val);
    }

    const expectToken = normalizeOnePaySecretValue(
      this.config.onepayWebhookToken || ""
    );
    const secret = normalizeOnePaySecretValue(
      this.config.onepayWebhookSecret || ""
    );

    const tok = normalizeOnePaySecretValue(
      headersNorm["x-webhook-token"] ||
        headersNorm["x-onepay-token"] ||
        ""
    );

    const sig = collectOnePaySignatureHeader(headersNorm);
    const bodyObj = parsedBodyForSignature ?? payload;
    const normPreview = normalizeOnePayWebhookPayload(bodyObj);
    const payPreview = normPreview.payment as
      | {id?: string; external_id?: string}
      | undefined;
    const chPreview = normPreview.charge as {id?: string} | undefined;

    /** 1) Con firma: HMAC con wh_tok_. 2) Sin firma (observado en producción OnePay): solo token wh_hdr_. */
    const hasSig = Boolean(sig);
    if (hasSig) {
      if (!secret) {
        throw new Error("ONEPAY_WEBHOOK_SECRET no configurado");
      }
      const sigCheck = verifyOnePayWebhookSignatureDetailed(
        rawBody,
        bodyObj,
        secret,
        sig
      );
      if (!sigCheck.ok) {
        console.error("[onepay webhook] firma HMAC rechazada", {
          attempts: sigCheck.attempts,
          rawBodyLength: rawBody.length,
          signatureHeaderLen: sig.length,
          interestingHeaders: onePayWebhookInterestingHeaderKeys(headersNorm),
          paymentIdFromPayload: payPreview?.id ?? null,
          chargeIdFromPayload: chPreview?.id ?? null,
          externalIdFromPayload: payPreview?.external_id ?? null,
          eventType: normPreview.event?.type ?? null,
          hint:
            "ONEPAY_WEBHOOK_SECRET debe ser el wh_tok_ del webhook (ver docs.onepay.la/client/webhooks/create)",
        });
        throw new Error("Firma OnePay inválida");
      }
      console.log("[onepay webhook] firma HMAC OK", {
        via: sigCheck.attempts.filter((a) => a.ok).map((a) => a.source),
      });
      if (expectToken && tok !== expectToken) {
        console.warn(
          "[onepay webhook] x-webhook-token no coincide con ONEPAY_WEBHOOK_TOKEN; se procesa porque la firma HMAC es válida.",
          {headerTokenLen: tok.length, expectedTokenLen: expectToken.length}
        );
      }
    } else {
      console.warn("[onepay webhook] Sin cabecera de firma (x-signature, etc.)", {
        interestingHeaders: onePayWebhookInterestingHeaderKeys(headersNorm),
        rawBodyLength: rawBody.length,
        eventType: normPreview.event?.type ?? null,
        hint:
          "Algunas entregas de OnePay solo envían x-webhook-token. Configura ONEPAY_WEBHOOK_TOKEN = wh_hdr_ del panel.",
      });
      if (!expectToken) {
        throw new Error(
          "OnePay webhook sin x-signature: configura ONEPAY_WEBHOOK_TOKEN (wh_hdr_) para validar el origen"
        );
      }
      if (tok !== expectToken) {
        console.error("[onepay webhook] Sin firma HMAC y token inválido", {
          headerTokenLen: tok.length,
          expectedTokenLen: expectToken.length,
        });
        throw new Error("OnePay webhook token inválido");
      }
      console.warn(
        "[onepay webhook] Aceptado solo con x-webhook-token (no vino firma HMAC)"
      );
    }

    const norm = normalizeOnePayWebhookPayload(bodyObj);
    const eventType = norm.event?.type || "";
    const apiKey = this.config.onepayApiKey?.trim();

    const pay = norm.payment;
    const ch = norm.charge;

    let paymentIdForState: string | undefined;
    let detailStatus: string | undefined;
    let detailAmount: number | string | undefined;
    let detailMethod: string | undefined;
    let externalIdFromPayload = "";

    if (pay?.id) {
      paymentIdForState = pay.id;
      detailStatus = pay.status;
      detailAmount = pay.amount;
      detailMethod = pay.payment_method;
      externalIdFromPayload = onepayPickExternalId(pay as Record<string, unknown>);
      if (!externalIdFromPayload) {
        externalIdFromPayload = ticketIdFromOnePayMetadata(pay.metadata);
      }
    } else if (ch) {
      const srcType = String(ch.source?.type || "").toLowerCase();
      paymentIdForState =
        srcType === "payment" && ch.source?.id ? ch.source.id : ch.id;
      detailStatus = ch.status;
      detailAmount = ch.amount;
      detailMethod = ch.payment_method_type || ch.payment_method_id;
      externalIdFromPayload = onepayPickExternalId(ch as Record<string, unknown>);
      if (!externalIdFromPayload && ch.metadata) {
        externalIdFromPayload = ticketIdFromOnePayMetadata(ch.metadata);
      }
    } else {
      console.warn("[onepay webhook] Sin objeto payment ni charge en el payload");
      return;
    }

    if (!paymentIdForState) {
      console.warn("[onepay webhook] Sin id de cobro/pago resoluble");
      return;
    }

    let mergedExternal = externalIdFromPayload;
    if (apiKey) {
      try {
        const d = await onepayGetPayment(apiKey, paymentIdForState);
        detailStatus = d.status || detailStatus;
        detailAmount = d.amount ?? detailAmount;
        detailMethod = d.payment_method || detailMethod;
        const fromApi = onepayPickExternalId(d as Record<string, unknown>);
        if (fromApi) mergedExternal = fromApi;
      } catch (e) {
        console.warn(
          "[onepay webhook] No se pudo consultar el cobro; se usa payload",
          (e as Error).message
        );
      }
    }

    let ticketId = String(mergedExternal || "").trim();
    if (!ticketId) {
      ticketId =
        (await this.ticketRepository.findDocIdByPreferenceId(
          paymentIdForState
        )) || "";
    }
    if (!ticketId) {
      console.error("[onepay webhook] Falta external_id y no hay ticket por preferenceId", {
        paymentId: paymentIdForState,
        eventType,
      });
      return;
    }

    const internal = mapOnePayPaymentStatusToInternal(detailStatus, eventType);
    if (!internal) {
      console.log(
        "[onepay webhook] Sin acción para estado:",
        detailStatus,
        eventType
      );
      return;
    }

    const amountNum = onepayAmountToNumber(
      detailAmount ?? pay?.amount ?? ch?.amount
    );

    await this.updateTicketFromPayment(ticketId, {
      id: paymentIdForState,
      status: internal,
      payment_method_id: String(detailMethod || "").trim() || "onepay",
      external_reference: ticketId,
      transaction_amount: amountNum,
    });
    console.log("[onepay webhook] ticket actualizado", {
      ticketId,
      paymentId: paymentIdForState,
      internalStatus: internal,
      eventType,
    });
  }

  /**
   * Procesa una notificación de webhook
   * @param {WebhookNotification} notification - Notificación del webhook
   * @param {Record<string, string>} headers - Headers de la petición
   */
  /**
   * Resuelve el id de documento Firestore del ticket a partir del pago MP.
   */
  private async resolveTicketIdFromWebhookPayment(
    paymentData: PaymentData
  ): Promise<string | null> {
    let ticketId = String(paymentData.external_reference ?? "").trim();
    if (!ticketId) {
      const meta = paymentData.metadata;
      if (meta && typeof meta === "object" && !Array.isArray(meta)) {
        const m = meta as Record<string, unknown>;
        ticketId = String(m.ticket_id ?? m.ticketId ?? "").trim();
      }
    }
    if (!ticketId) {
      const pref =
        (paymentData as {preference_id?: string}).preference_id ??
        (paymentData as {preferenceId?: string}).preferenceId;
      if (pref) {
        ticketId =
          (await this.ticketRepository.findDocIdByPreferenceId(String(pref))) ||
          "";
      }
    }
    return ticketId || null;
  }

  async processWebhookNotification(
    notification: WebhookNotification,
    headers: Record<string, string>
  ): Promise<void> {
    try {
      console.log("Processing webhook notification:", JSON.stringify(notification, null, 2));

      const headersNorm: Record<string, string> = {};
      for (const [k, v] of Object.entries(headers || {})) {
        if (v === undefined || v === null) continue;
        const val = Array.isArray(v) ? v[0] : v;
        headersNorm[String(k).toLowerCase()] = String(val);
      }
      const xSignature = headersNorm["x-signature"];
      const xRequestId = headersNorm["x-request-id"];

      // Verificar si es una notificación de prueba
      const dataIdRaw = notification.data?.id;
      const dataIdForTest =
        dataIdRaw === undefined || dataIdRaw === null ?
          "" :
          String(dataIdRaw);
      if (!notification.live_mode && dataIdForTest === "123456") {
        console.log("Test webhook received - skipping processing");
        return;
      }

      // Validar firma de seguridad para notificaciones reales
      if (notification.live_mode && xSignature && xRequestId && dataIdForTest) {
        const isValidSignature = this.paymentProvider.validateWebhookSignature(
          xSignature,
          xRequestId,
          dataIdForTest,
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

      if (notification.type && dataIdRaw !== undefined && dataIdRaw !== null) {
        resourceType = notification.type;
        resourceId = String(dataIdRaw);
      } else if (notification.topic && notification.resource) {
        resourceType = notification.topic;
        const resourceUrl = notification.resource;
        const urlParts = resourceUrl.split("/");
        resourceId = urlParts[urlParts.length - 1] || "";
      } else if (
        notification.action &&
        /payment/i.test(String(notification.action)) &&
        dataIdRaw !== undefined &&
        dataIdRaw !== null
      ) {
        resourceType = "payment";
        resourceId = String(dataIdRaw);
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
        const paymentData = await this.getPaymentForWebhook(resourceId);
        console.log("Payment data retrieved:", JSON.stringify(paymentData, null, 2));

        const ticketId = await this.resolveTicketIdFromWebhookPayment(paymentData);
        if (!ticketId) {
          console.error(
            "No ticket id: external_reference vacío y sin metadata/preference_id resoluble",
            {paymentId: paymentData.id}
          );
          return;
        }

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
              const paymentData = await this.getPaymentForWebhook(payment.id);
              const ticketId = await this.resolveTicketIdFromWebhookPayment(paymentData);
              if (ticketId) {
                await this.updateTicketFromPayment(ticketId, paymentData);
                console.log(`Processed payment ${payment.id} from merchant order ${resourceId}`);
              } else {
                console.warn(
                  "merchant_order: no ticket id for payment",
                  {paymentId: payment.id}
                );
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
      const ticket = await this.ticketRepository.findById(ticketId);
      if (!ticket) {
        console.error(`Ticket not found: ${ticketId}`);
        return;
      }

      const baseUpdate: Partial<Ticket> = {
        paymentId: paymentData.id,
        paymentStatus: paymentData.status,
        paymentMethod: paymentData.payment_method_id || "",
      };

      switch (paymentData.status) {
      case "approved": {
        if (
          ticket.paymentId === paymentData.id &&
          ticket.paymentStatus === "approved"
        ) {
          console.log(
            `[updateTicketFromPayment] Idempotente: pago ${paymentData.id} ya aplicado`
          );
          return;
        }
        const phase = ticket.installmentPhase || "none";
        const paid = mpPaidCOP(paymentData);

        if (phase === "awaiting_deposit") {
          const expDep = Number(ticket.depositCOP) || 0;
          if (Math.abs(paid - expDep) > 20 && expDep > 0) {
            console.warn(
              `[abono] Monto abono distinto ticket ${ticketId}: pagado ${paid} esperado ~${expDep}`
            );
          }
          await this.ticketRepository.update(ticketId, {
            ...baseUpdate,
            installmentPhase: "deposit_paid",
            ticketStatus: "reserved",
            qrCode: "",
            initPoint: `${this.config.appUrl}/tickets`,
          });
          await this.sendDepositConfirmationIfPossible(ticketId, ticket);
          return;
        }

        if (phase === "awaiting_balance") {
          const expBal = Number(ticket.balanceCOP) || 0;
          if (Math.abs(paid - expBal) > 20 && expBal > 0) {
            console.warn(
              `[abono] Monto saldo distinto ticket ${ticketId}: pagado ${paid} esperado ~${expBal}`
            );
          }
          await this.ticketRepository.update(ticketId, {
            ...baseUpdate,
            installmentPhase: "completed",
            ticketStatus: "paid",
            initPoint: `${this.config.appUrl}/tickets`,
          });
          const snap = await admin.firestore().collection("tickets").doc(ticketId).get();
          await finalizePaidTicketsWithBundle(
            admin.firestore(),
            ticketId,
            {...(snap.data() || {})},
            this.qrGenerator,
            this.config.appUrl,
            this.ticketRepository
          );
          await this.sendPaidPurchaseTicketsEmail(ticketId);
          return;
        }

        // Pago único al contado
        await this.ticketRepository.update(ticketId, {
          ...baseUpdate,
          ticketStatus: "paid",
          initPoint: `${this.config.appUrl}/tickets`,
        });
        const snapSingle = await admin.firestore().collection("tickets").doc(ticketId).get();
        await finalizePaidTicketsWithBundle(
          admin.firestore(),
          ticketId,
          {...(snapSingle.data() || {})},
          this.qrGenerator,
          this.config.appUrl,
          this.ticketRepository
        );
        await this.sendPaidPurchaseTicketsEmail(ticketId);
        return;
      }

      case "rejected":
        await this.ticketRepository.update(ticketId, {
          ...baseUpdate,
          ticketStatus: "cancelled",
        });
        break;

      case "pending":
        await this.ticketRepository.update(ticketId, {
          ...baseUpdate,
          ticketStatus: "reserved",
        });
        break;

      default:
        console.log(`Unhandled payment status: ${paymentData.status}`);
        await this.ticketRepository.update(ticketId, baseUpdate);
      }

      console.log(`Ticket ${ticketId} updated with payment status: ${paymentData.status}`);
    } catch (error) {
      console.error("Error updating ticket:", error);
      throw error;
    }
  }

  /**
   * Tras pago completo (invitado o con sesión): envía PDF con QRs al buyerEmail por Resend.
   * No lanza si falla el correo (el webhook ya marcó el ticket pagado).
   */
  private async sendPaidPurchaseTicketsEmail(parentTicketId: string): Promise<void> {
    const r = this.config.resend;
    if (!r?.apiKey || !r.senderEmail) {
      console.warn(
        "[ticket email] RESEND_API_KEY / SENDER_EMAIL no configurados; sin PDF de entradas"
      );
      return;
    }
    const db = admin.firestore();
    const parentRef = db.collection("tickets").doc(parentTicketId);
    const emailIdemRef = parentRef
      .collection("_idempotency")
      .doc("purchase_pdf_email");

    let emailLockAcquired = false;
    try {
      await db.runTransaction(async (tx) => {
        const es = await tx.get(emailIdemRef);
        if (es.exists) {
          emailLockAcquired = false;
          return;
        }
        tx.create(emailIdemRef, {
          at: admin.firestore.FieldValue.serverTimestamp(),
        });
        emailLockAcquired = true;
      });
    } catch (e) {
      console.error("[ticket email] idempotencia (tx)", (e as Error).message);
      return;
    }

    if (!emailLockAcquired) {
      console.log(
        "[ticket email] Omitido: correo con PDF ya enviado o en proceso (webhook duplicado)",
        parentTicketId
      );
      return;
    }

    const releaseEmailIdem = async (): Promise<void> => {
      await emailIdemRef.delete().catch(() => undefined);
    };

    try {
      const parentSnap = await parentRef.get();
      if (!parentSnap.exists) {
        await releaseEmailIdem();
        return;
      }
      const parent = parentSnap.data() as Record<string, unknown>;

      const buyerEmail = String(parent.buyerEmail || "").trim();
      if (!buyerEmail) {
        console.warn("[ticket email] Sin buyerEmail", parentTicketId);
        await releaseEmailIdem();
        return;
      }

      const eventId = String(parent.eventId || "");
      let eventDoc = await db.collection("events").doc(eventId).get();
      if (!eventDoc.exists) {
        eventDoc = await db.collection("recurring_events").doc(eventId).get();
      }
      if (!eventDoc.exists) {
        console.warn("[ticket email] Evento no encontrado", eventId);
        await releaseEmailIdem();
        return;
      }
      const eventData = eventDoc.data() as Record<string, unknown>;
      const meta = parent.metadata as
        | {eventName?: string; userName?: string; buyerIdNumber?: string}
        | undefined;
      const eventName =
        String(meta?.eventName || "").trim() ||
        String(eventData.title || eventData.name || "Evento");
      const buyerName = String(meta?.userName || "").trim() || buyerEmail;

      const eventDate = eventData.date ?? "";
      const eventTime = String(eventData.time ?? "");
      const venueName = String((eventData.venue as {name?: string})?.name || "");
      const city = String(eventData.city || "");
      const parentAmount = Math.round(Number(parent.amount) || 0);

      const ticketsWithQR: Array<{
        ticket: {
          ticketId: string;
          id: string;
          eventName: string;
          eventDate: unknown;
          eventTime: string;
          eventVenue: string;
          city: string;
          buyerName: string;
          buyerEmail: string;
          price: number;
          sectionName?: string;
          buyerIdNumber?: string;
        };
        qrCodeImage: string;
      }> = [];

      const childIds = parent.childTicketIds as string[] | undefined;
      if (Array.isArray(childIds) && childIds.length > 0) {
        const perPass = Math.max(
          0,
          Math.round(parentAmount / childIds.length)
        );
        for (const cid of childIds) {
          const cs = await db.collection("tickets").doc(cid).get();
          const cd = cs.data() as Record<string, unknown> | undefined;
          if (!cd) continue;
          const qrUrl = String(cd.qrCode || "").trim();
          if (!qrUrl) continue;
          const qrCodeImage = await QRCode.toDataURL(qrUrl, {
            errorCorrectionLevel: "M",
            width: 200,
          });
          const childMeta = cd.metadata as
            | {seatNumber?: string; buyerIdNumber?: string}
            | undefined;
          const localityLine = String(
            childMeta?.seatNumber ||
              cd.sectionName ||
              parent.sectionName ||
              ""
          ).trim();
          const buyerIdDoc = String(
            childMeta?.buyerIdNumber ?? meta?.buyerIdNumber ?? ""
          ).trim();
          ticketsWithQR.push({
            ticket: {
              ticketId: cid,
              id: cid,
              eventName,
              eventDate,
              eventTime,
              eventVenue: venueName,
              city,
              buyerName,
              buyerEmail,
              price: perPass,
              sectionName: localityLine,
              ...(buyerIdDoc ? {buyerIdNumber: buyerIdDoc} : {}),
            },
            qrCodeImage,
          });
        }
      } else {
        const qrUrl = String(parent.qrCode || "").trim();
        if (!qrUrl) {
          console.warn("[ticket email] Sin QR en documento padre", parentTicketId);
          await releaseEmailIdem();
          return;
        }
        const qrCodeImage = await QRCode.toDataURL(qrUrl, {
          errorCorrectionLevel: "M",
          width: 200,
        });
        const parentMeta = parent.metadata as
          | {seatNumber?: string; buyerIdNumber?: string}
          | undefined;
        const parentLocalityLine = String(
          parentMeta?.seatNumber || parent.sectionName || ""
        ).trim();
        const parentBuyerId = String(parentMeta?.buyerIdNumber ?? "").trim();
        ticketsWithQR.push({
          ticket: {
            ticketId: parentTicketId,
            id: parentTicketId,
            eventName,
            eventDate,
            eventTime,
            eventVenue: venueName,
            city,
            buyerName,
            buyerEmail,
            price: parentAmount,
            sectionName: parentLocalityLine,
            ...(parentBuyerId ? {buyerIdNumber: parentBuyerId} : {}),
          },
          qrCodeImage,
        });
      }

      if (ticketsWithQR.length === 0) {
        console.warn("[ticket email] Sin filas para PDF", parentTicketId);
        await releaseEmailIdem();
        return;
      }

      const pdfBuffer = await generateMultipleTicketsPdf(ticketsWithQR, eventData);
      await sendTicketEmail(
        buyerEmail,
        `Tus entradas: ${eventName}`,
        eventName,
        buyerName,
        pdfBuffer,
        r.apiKey,
        r.senderEmail,
        r.senderName || "Ticket Colombia"
      );
      console.log("[ticket email] PDF enviado", parentTicketId);
    } catch (e) {
      await releaseEmailIdem();
      console.error("[ticket email]", (e as Error).message, (e as Error).stack);
    }
  }

  private async sendDepositConfirmationIfPossible(
    ticketId: string,
    ticket: Ticket
  ): Promise<void> {
    const r = this.config.resend;
    if (!r?.apiKey || !r.senderEmail) {
      console.warn("[abono] Resend no configurado; sin correo de confirmación de abono");
      return;
    }
    const token = ticket.abonoCompletionToken;
    if (!token) return;
    const balanceDue = ticket.balanceDueAt as admin.firestore.Timestamp | undefined;
    const dueLabel =
      balanceDue?.toDate ?
        balanceDue.toDate().toLocaleString("es-CO", {
          dateStyle: "long",
          timeStyle: "short",
        }) :
        "";
    const url = `${this.config.appUrl}/completar-abono?token=${encodeURIComponent(token)}`;
    try {
      await sendAbonoDepositConfirmedEmail({
        to: ticket.buyerEmail,
        buyerName: ticket.metadata?.userName || "Cliente",
        eventName: ticket.metadata?.eventName || "Evento",
        depositCOP: Number(ticket.depositCOP) || 0,
        balanceCOP: Number(ticket.balanceCOP) || 0,
        balanceDueLabel: dueLabel,
        completePaymentUrl: url,
        resendApiKey: r.apiKey,
        senderEmail: r.senderEmail,
        senderName: r.senderName || "Ticket Colombia",
      });
    } catch (e) {
      console.error("[abono] Error enviando correo:", (e as Error).message);
    }
  }

  /**
   * Link de pago (Mercado Pago u OnePay) para saldo pendiente de un abono.
   * @param {string} ticketId ID del documento de compra en Firestore
   * @param {string} userId Usuario autenticado dueño del ticket
   */
  async createBalanceInstallmentPreference(
    ticketId: string,
    userId: string
  ): Promise<PreferenceResponse> {
    const db = admin.firestore();
    const ticket = await this.ticketRepository.findById(ticketId);
    if (!ticket) {
      throw new Error("Compra no encontrada");
    }
    if (ticket.userId !== userId) {
      throw new Error("Esta compra pertenece a otra cuenta");
    }
    if (ticket.installmentPhase !== "deposit_paid") {
      throw new Error("No hay saldo pendiente para esta compra");
    }
    const due = ticket.balanceDueAt as admin.firestore.Timestamp | undefined;
    if (due?.toMillis && due.toMillis() < Date.now()) {
      throw new Error("Venció el plazo para completar el pago. La reserva pudo haberse liberado.");
    }
    const balanceCOP = Math.round(Number(ticket.balanceCOP) || 0);
    if (balanceCOP < this.config.minAmount) {
      throw new Error(`El saldo es inferior al mínimo permitido (${this.config.minAmount} COP)`);
    }

    let eventDoc = await db.collection("events").doc(ticket.eventId).get();
    if (!eventDoc.exists) {
      eventDoc = await db.collection("recurring_events").doc(ticket.eventId).get();
    }
    if (!eventDoc.exists) {
      throw new Error("Evento no encontrado");
    }
    const eventData = eventDoc.data()!;

    const paymentProvider = paymentProviderFromEventData(eventData);

    const q = Math.max(1, Number(ticket.quantity) || 1);
    const balanceReturnUrl = (() => {
      const base = `${this.config.appUrl}/compra-finalizada`;
      const qs = new URLSearchParams({
        event: String(eventData.slug || eventData.id),
        value: String(balanceCOP),
        name: String(eventData.name || ""),
        qty: String(q),
        abono_balance: "1",
      });
      return `${base}?${qs.toString()}`;
    })();

    await this.ticketRepository.update(ticketId, {
      installmentPhase: "awaiting_balance",
    });

    if (paymentProvider === "onepay") {
      const apiKey = this.config.onepayApiKey?.trim();
      if (!apiKey) {
        await this.ticketRepository.update(ticketId, {installmentPhase: "deposit_paid"});
        throw new Error("OnePay no está configurado (ONEPAY_API_KEY)");
      }
      try {
        const created = await onepayCreatePayment({
          apiKey,
          amount: balanceCOP,
          title: `${this.config.isDevelopment ? "[DEV] " : ""}Saldo · ${
            eventData.title || eventData.name}`,
          email: ticket.buyerEmail,
          externalId: ticketId,
          reference: `${ticketId}_balance`,
          redirectUrl: balanceReturnUrl,
          idempotencyKey: randomUUID().replace(/-/g, ""),
          description: `Pago pendiente — ${eventData.title || eventData.name}`,
          metadataPairs: [
            {key: "ticketId", value: ticketId},
            {key: "kind", value: "abono_balance"},
          ],
        });
        const link = (created.payment_link || "").trim();
        const pid = (created.id || "").trim();
        if (!pid || !link) {
          throw new Error("OnePay no devolvió id o payment_link");
        }
        await this.ticketRepository.update(ticketId, {
          preferenceId: pid,
          initPoint: link,
        });
        return {
          ticketId,
          preferenceId: pid,
          initPoint: link,
          sandboxInitPoint: link,
        };
      } catch (e) {
        await this.ticketRepository.update(ticketId, {installmentPhase: "deposit_paid"});
        throw e;
      }
    }

    const organizerUid = String(eventData.organizer_id || "").trim();
    const sellerAccessToken = await loadOrganizerSellerAccessToken(db, organizerUid);

    const balanceTitle = `${this.config.isDevelopment ? "[DEV] " : ""}Saldo · ${
      eventData.title || eventData.name}`;
    const balanceDesc = `Pago pendiente — ${eventData.title || eventData.name}`;
    try {
      const created = await this.createCheckoutProPreference({
        amountCOP: balanceCOP,
        ticketId,
        payerEmail: ticket.buyerEmail,
        itemTitle: balanceTitle,
        itemDesc: balanceDesc,
        successUrl: balanceReturnUrl,
        eventId: ticket.eventId,
        sellerAccessToken,
        marketplaceFeeCOP: 0,
      });
      await this.ticketRepository.update(ticketId, {
        preferenceId: created.id,
        initPoint: created.initPoint,
      });
      return {
        ticketId,
        preferenceId: created.id,
        initPoint: created.initPoint,
        sandboxInitPoint: created.sandboxInitPoint,
      };
    } catch (e) {
      await this.ticketRepository.update(ticketId, {installmentPhase: "deposit_paid"});
      throw e;
    }
  }
}
