import React, { useEffect, useState, useRef, useMemo } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import {
  getEventBySlug,
  getPaymentConfig,
  getOrganizerBuyerFee,
  getUserData,
  createTicket,
  createTicketReservation,
  releaseTicketReservation,
  metaPixel,
  onAuthStateChange,
} from "../../services";
import type { Event, UserData, TicketData, OrganizerBuyerFeeDoc } from "../../services";
import {
  computeBuyerServiceFeeCOP,
  buyerServiceFeeLabel,
} from "../../utils/buyerServiceFee";
import { persistMercadoPagoReturnIntent } from "../../utils/mpCheckoutReturnIntent";
import { useContactConfig } from "../../contexts/ContactConfigContext";
import TopNavBar from "../../containers/TopNavBar";
import Loader from "../../components/Loader";
import PrimaryButton from "../../components/PrimaryButton";
import SecondaryButton from "../../components/SecondaryButton";
import CustomInput from "../../components/CustomInput";
import {
  IconCheckoutCalendar,
  IconCheckoutLocation,
  IconCheckoutPayOnline,
  IconCheckoutTimer,
} from "../../components/CheckoutUserIcons";
import "./index.scss";

const CheckoutScreen: React.FC = () => {
  const { whatsappPhone } = useContactConfig();
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [event, setEvent] = useState<Event | null>(null);
  const [paymentConfig, setPaymentConfig] = useState<{
    fees: number;
  } | null>(null);
  const [organizerBuyerFee, setOrganizerBuyerFee] =
    useState<OrganizerBuyerFeeDoc | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [quantity, setQuantity] = useState<number>(1);
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);
  const [userData, setUserData] = useState<UserData | null>(null);
  const [paymentLoading, setPaymentLoading] = useState<boolean>(false);
  const [paymentMethod, setPaymentMethod] = useState<
    "mercadopago" | "whatsapp"
  >("mercadopago");
  const [guestEmail, setGuestEmail] = useState("");
  const [guestName, setGuestName] = useState("");
  const [reservationId, setReservationId] = useState<string | null>(null);
  const [reservationExpiresAt, setReservationExpiresAt] = useState<number | null>(null);
  const [reservationLoading, setReservationLoading] = useState(false);
  const [reservationTick, setReservationTick] = useState(0);
  const [authReady, setAuthReady] = useState(false);
  const reservationReleaseRef = useRef<string | null>(null);
  const prevAuthenticatedRef = useRef<boolean | null>(null);
  const { slug } = useParams<{ slug: string }>();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  const initialQuantity = Math.max(1, parseInt(searchParams.get("quantity") || "1"));
  const sectionId = searchParams.get("sectionId") || undefined;
  const sectionName = searchParams.get("sectionName") || undefined;

  const unitPrice = (() => {
    if (!event) return 0;
    if (sectionId && sectionName && event.sections?.length) {
      const sec = event.sections.find((s) => s.id === sectionId);
      return sec?.price ?? event.ticket_price;
    }
    return event.ticket_price;
  })();

  // Efecto para hacer scroll al top cuando el componente se monta
  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  // Initialize quantity from URL params
  useEffect(() => {
    setQuantity(initialQuantity);
  }, [initialQuantity]);

  useEffect(() => {
    const unsub = onAuthStateChange(async (user) => {
      setIsAuthenticated(!!user);
      if (user) {
        try {
          const userDataResult = await getUserData(user.uid);
          setUserData(userDataResult);
        } catch (error) {
          console.error("Error al obtener datos del usuario:", error);
        }
      } else {
        setUserData(null);
      }
      setAuthReady(true);
    });
    return () => unsub();
  }, []);

  /** Invitado → cuenta: liberar reserva hecha con sessionKey */
  useEffect(() => {
    const prev = prevAuthenticatedRef.current;
    if (prev === false && isAuthenticated) {
      const id = reservationReleaseRef.current;
      if (id) {
        void releaseTicketReservation({ reservationId: id }).then(() => {
          if (reservationReleaseRef.current === id) {
            reservationReleaseRef.current = null;
            setReservationId(null);
            setReservationExpiresAt(null);
          }
        });
      }
    }
    prevAuthenticatedRef.current = isAuthenticated;
  }, [isAuthenticated]);

  /** Reserva de cupo (10 min); al cambiar cantidad/localidad o auth se recrea la reserva */
  useEffect(() => {
    if (!event || quantity < 1 || !authReady) return;

    let cancelled = false;
    const ridLocal = { current: null as string | null };

    (async () => {
      try {
        setReservationLoading(true);
        const res = await createTicketReservation({
          eventId: event.id,
          quantity,
          sectionId,
          sectionName,
        });
        ridLocal.current = res.reservationId;
        if (cancelled) {
          await releaseTicketReservation({
            reservationId: res.reservationId,
          }).catch(() => undefined);
          ridLocal.current = null;
          return;
        }
        reservationReleaseRef.current = res.reservationId;
        setReservationId(res.reservationId);
        setReservationExpiresAt(res.expiresAt);
        setError(null);
      } catch (e) {
        if (!cancelled) {
          setReservationId(null);
          setReservationExpiresAt(null);
          setError(
            e instanceof Error
              ? e.message
              : "No se pudo reservar cupo para esta compra"
          );
        }
      } finally {
        if (!cancelled) setReservationLoading(false);
      }
    })();

    return () => {
      cancelled = true;
      const id = ridLocal.current;
      if (id) {
        void releaseTicketReservation({ reservationId: id }).catch(() => undefined);
      }
      if (reservationReleaseRef.current === id) {
        reservationReleaseRef.current = null;
      }
    };
  }, [
    event?.id,
    quantity,
    sectionId,
    sectionName,
    isAuthenticated,
    userData?.uid,
    authReady,
  ]);

  useEffect(() => {
    return () => {
      const id = reservationReleaseRef.current;
      if (id) {
        void releaseTicketReservation({ reservationId: id }).catch(() => undefined);
      }
    };
  }, []);

  useEffect(() => {
    if (!reservationExpiresAt) return;
    const t = window.setInterval(() => setReservationTick((n) => n + 1), 1000);
    return () => window.clearInterval(t);
  }, [reservationExpiresAt]);

  const handleQuantityChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;

    // Permitir campo vacío para que el usuario pueda borrar
    if (value === "") {
      setQuantity(0);
      return;
    }

    const numValue = parseInt(value);

    // Solo validar que sea un número válido, sin restricciones durante la escritura
    if (!isNaN(numValue) && numValue >= 0) {
      setQuantity(numValue);
    }
  };

  useEffect(() => {
    const fetchData = async () => {
      try {
        setIsLoading(true);

        if (!slug) {
          setError("Slug del evento no proporcionado");
          setIsLoading(false);
          return;
        }

        const [eventData, configData] = await Promise.all([
          getEventBySlug(slug),
          getPaymentConfig(),
        ]);

        if (!eventData) {
          setError("Evento no encontrado");
          setIsLoading(false);
          return;
        }

        const orgFee = eventData.organizer_id
          ? await getOrganizerBuyerFee(eventData.organizer_id)
          : null;

        setEvent(eventData);
        setPaymentConfig(configData);
        setOrganizerBuyerFee(orgFee);
        setError(null);

        const cfgFees = configData?.fees ?? 9;
        const q0 = Math.max(
          1,
          parseInt(searchParams.get("quantity") || "1", 10)
        );
        const secId0 = searchParams.get("sectionId") || undefined;
        let unit0 = eventData.ticket_price;
        if (secId0 && eventData.sections?.length) {
          const s = eventData.sections.find((x) => x.id === secId0);
          if (s) unit0 = s.price;
        }
        const sub0 = unit0 * q0;
        const fee0 =
          unit0 <= 0
            ? 0
            : computeBuyerServiceFeeCOP(
                sub0,
                q0,
                eventData,
                cfgFees,
                orgFee
              ).feeCOP;
        metaPixel.trackInitiateCheckout(eventData.name, sub0 + fee0, q0);
      } catch (err) {
        console.error("Error al cargar los datos:", err);
        setError("Error al cargar los datos");
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
  }, [slug]);

  // Format date for display
  const formatDate = (dateStr: string) => {
    const options: Intl.DateTimeFormatOptions = {
      year: "numeric",
      month: "long",
      day: "numeric",
    };
    return new Date(dateStr).toLocaleDateString("es-ES", options);
  };

  // Format price
  const formatPrice = (price: number) => {
    return new Intl.NumberFormat("es-CO", {
      style: "currency",
      currency: "COP",
      minimumFractionDigits: 0,
    }).format(price);
  };

  const calculateSubtotal = () => {
    if (!event) return 0;
    return unitPrice * quantity;
  };

  const serviceFeeBreakdown = useMemo(() => {
    if (!event || !paymentConfig) return null;
    const qty = Math.max(0, quantity);
    const subtotal = unitPrice * qty;
    if (unitPrice <= 0 || qty < 1) {
      return {
        feeCOP: 0,
        line: "global_pct" as const,
        detailValue: paymentConfig.fees,
      };
    }
    return computeBuyerServiceFeeCOP(
      subtotal,
      qty,
      event,
      paymentConfig.fees,
      organizerBuyerFee
    );
  }, [event, paymentConfig, organizerBuyerFee, quantity, unitPrice]);

  const calculateFees = () => serviceFeeBreakdown?.feeCOP ?? 0;

  const feeLineDescription = () => {
    if (!event || !paymentConfig || !serviceFeeBreakdown) return "";
    if (serviceFeeBreakdown.feeCOP <= 0) return "";
    return buyerServiceFeeLabel(
      formatPrice,
      serviceFeeBreakdown.line,
      serviceFeeBreakdown.detailValue,
      Math.max(1, quantity)
    );
  };

  // Calculate final total (sin impuestos)
  const calculateTotal = () => {
    if (!event || !paymentConfig) return 0;
    const subtotal = calculateSubtotal();
    const fees = calculateFees();
    return subtotal + fees;
  };

  const handleMercadoPagoPayment = async () => {
    if (!event || quantity === 0) return;
    if (!reservationId) {
      setError("Espera a que termine la reserva de cupo o recarga la página.");
      return;
    }
    const useGuest = !isAuthenticated;
    if (useGuest && (!guestEmail.trim() || !guestName.trim())) {
      setError("Ingresa tu correo y nombre completo para continuar.");
      return;
    }
    if (!useGuest && !userData) return;

    setPaymentLoading(true);
    setError(null);

    try {
      const email = useGuest ? guestEmail.trim() : userData!.email;
      const displayName = useGuest ? guestName.trim() : (userData!.name || userData!.email);

      const ticketData: TicketData = {
        userId: useGuest ? "guest" : userData!.uid,
        eventId: event.id,
        amount: calculateTotal(),
        quantity: quantity,
        buyerEmail: email,
        reservationId,
        guestCheckout: useGuest,
        metadata: {
          userName: displayName,
          eventName: event.name,
          eventDate: formatDate(event.date),
          eventTime: event.time,
          venue: event.venue?.name || "Por confirmar",
          city: event.city,
          seatNumber: sectionName || "General",
          sectionId,
        },
      };

      const result = (await createTicket(ticketData)) as { initPoint?: string };

      // Misma URL que el backend usa en back_urls; si MP devuelve a /tickets (prefs viejas),
      // /tickets redirige aquí usando sessionStorage.
      const returnParams = new URLSearchParams({
        event: String(event.slug || event.id),
        value: String(calculateTotal()),
        name: String(event.name || ""),
        qty: String(quantity),
      });
      if (sectionName) {
        returnParams.set("section", sectionName);
      }
      const returnAbs = `${window.location.origin}/compra-finalizada?${returnParams.toString()}`;
      persistMercadoPagoReturnIntent(returnAbs);

      // Redirigir a MercadoPago
      if (result.initPoint) {
        window.location.href = result.initPoint;
      } else {
        throw new Error("No se pudo generar el enlace de pago");
      }
    } catch (error) {
      console.error("Error:", error);
      setError(
        error instanceof Error ? error.message : "Error al procesar la compra"
      );
    } finally {
      setPaymentLoading(false);
    }
  };

  // Handle WhatsApp payment (existing functionality)
  const handleWhatsAppPayment = () => {
    if (!event || quantity === 0) return;

    // Si el evento es externo y tiene una URL externa definida
    if (
      event.event_type === "external_url" &&
      event.external_url &&
      event.external_url.trim() !== ""
    ) {
      // Abrir la URL en una nueva pestaña
      window.open(event.external_url, "_blank");
      return;
    }

    // Para todos los demás casos, redirigir a WhatsApp con mensaje predefinido
    const quantityText = quantity === 1 ? "1 entrada" : `${quantity} entradas`;
    const subtotalText = formatPrice(calculateSubtotal());
    const feesText = formatPrice(calculateFees());
    const totalText = formatPrice(calculateTotal());

    let message =
      `Hola, quisiera confirmar mi reserva:\n\n` +
      `🎭 Evento: ${event.name}\n` +
      `📅 Fecha: ${formatDate(event.date)} - ${event.time}\n` +
      `📍 Lugar: ${event.venue?.name || "Por confirmar"}, ${event.city}\n` +
      `🎫 Cantidad: ${quantityText}\n\n` +
      `💰 Desglose de costos:\n` +
      `• Subtotal: ${subtotalText}\n`;

    // Only show fees if they apply
    if (calculateFees() > 0) {
      message += `• ${feeLineDescription()}: ${feesText}\n`;
    }

    message += `• Total: ${totalText}\n\n¡Espero su confirmación!`;

    const whatsappUrl = `https://wa.me/${whatsappPhone}?text=${encodeURIComponent(message)}`;

    // Trackear contacto via WhatsApp
    metaPixel.trackContact(event.name);

    window.open(whatsappUrl, "_blank");
  };

  // Handle payment process based on selected method
  const handlePayment = () => {
    if (event && unitPrice === 0) {
      handleMercadoPagoPayment();
      return;
    }
    
    if (paymentMethod === "mercadopago") {
      handleMercadoPagoPayment();
    } else {
      handleWhatsAppPayment();
    }
  };

  const handleGoBack = () => {
    // Use the slug from params, or fallback to event slug if available
    const eventSlug = slug || (event?.slug);
    if (eventSlug) {
      navigate(`/evento/${eventSlug}`);
    } else {
      navigate('/');
    }
  };

  // Helper functions for button state
  const getButtonText = () => {
    if (paymentLoading) return "Procesando...";
    if (event && unitPrice === 0) {
      return isAuthenticated ? "Reservar ahora" : "Reservar sin cuenta";
    }
    if (paymentMethod === "mercadopago") {
      return isAuthenticated ? "Pagar en línea" : "Pagar sin cuenta";
    }
    return "Confirmar reserva";
  };

  const isButtonDisabled = () => {
    if (!event || quantity === 0 || paymentLoading) return true;
    if (reservationLoading || !reservationId) return true;
    if (reservationExpiresAt && Date.now() > reservationExpiresAt) return true;
    if (isAuthenticated) return false;
    return !guestEmail.trim() || !guestName.trim();
  };

  const reservationCountdown = useMemo(() => {
    if (!reservationExpiresAt) return null;
    void reservationTick;
    const msLeft = Math.max(0, reservationExpiresAt - Date.now());
    const totalSec = Math.floor(msLeft / 1000);
    const minutes = Math.floor(totalSec / 60);
    const seconds = totalSec % 60;
    const display = `${minutes}:${String(seconds).padStart(2, "0")}`;
    const expired = msLeft <= 0;
    const ariaLabel = expired
      ? "El tiempo de la reserva ha vencido"
      : `${minutes} minuto${minutes === 1 ? "" : "s"} y ${seconds} segundo${seconds === 1 ? "" : "s"} para completar el pago`;
    return {
      display,
      totalSec,
      expired,
      urgent: totalSec > 0 && totalSec <= 120,
      critical: totalSec > 0 && totalSec <= 60,
      ariaLabel,
    };
  }, [reservationExpiresAt, reservationTick]);

  if (isLoading) {
    return (
      <div className="checkout-screen">
        <TopNavBar logoOnly={true} />
        <div className="loading-container">
          <Loader size="large" color="accent" />
        </div>
      </div>
    );
  }

  if (error || !event) {
    return (
      <div className="checkout-screen">
        <TopNavBar logoOnly={true} />
        <div className="error-container">
          <h2>Error</h2>
          <p>{error || "No se pudo cargar el evento"}</p>
          <SecondaryButton onClick={() => navigate("/")}>
            Volver al inicio
          </SecondaryButton>
        </div>
      </div>
    );
  }

  const showReservationFloat =
    reservationLoading || Boolean(reservationId && reservationCountdown);

  return (
    <div className="checkout-screen">
      <TopNavBar logoOnly={true} />

      {showReservationFloat && (
        <div className="checkout-reservation-float">
          {reservationLoading ? (
            <div className="checkout-reservation-chip checkout-reservation-chip--loading">
              <span className="checkout-reservation-chip__spinner" aria-hidden />
              <span className="checkout-reservation-chip__loading-text">
                Apartando cupo…
              </span>
            </div>
          ) : (
            reservationCountdown && (
              <div
                className={[
                  "checkout-reservation-chip",
                  reservationCountdown.expired && "checkout-reservation-chip--expired",
                  !reservationCountdown.expired &&
                    reservationCountdown.critical &&
                    "checkout-reservation-chip--critical",
                  !reservationCountdown.expired &&
                    !reservationCountdown.critical &&
                    reservationCountdown.urgent &&
                    "checkout-reservation-chip--urgent",
                ]
                  .filter(Boolean)
                  .join(" ")}
                role="timer"
                aria-live="polite"
                aria-atomic="true"
                aria-label={reservationCountdown.ariaLabel}
              >
                <div className="checkout-reservation-chip__row" aria-hidden>
                  <span className="checkout-reservation-chip__icon-wrap">
                    <IconCheckoutTimer className="checkout-reservation-chip__svg" />
                  </span>
                  <span className="checkout-reservation-chip__time">
                    {reservationCountdown.expired
                      ? "0:00"
                      : reservationCountdown.display}
                  </span>
                </div>
                <p className="checkout-reservation-chip__hint">
                  {reservationCountdown.expired
                    ? "Tu tiempo se agotó. Actualiza o vuelve al evento."
                    : "Te queda este tiempo para completar el pago."}
                </p>
              </div>
            )
          )}
        </div>
      )}

      <div className="checkout-content">
        <div className="checkout-header">
          <h1>Resumen de compra</h1>
          <p>Revisa los detalles de tu reserva antes de confirmar</p>
        </div>

        <div className="checkout-summary">
          <div className="event-summary">
            <div className="event-image">
              <img src={event.cover_image_url} alt={event.name} />
            </div>

            <div className="event-info">
              <h2 className="event-info__title">{event.name}</h2>
              <div className="event-meta">
                <div className="event-meta__item">
                  <span className="event-meta__icon-wrap" aria-hidden>
                    <IconCheckoutCalendar className="event-meta__svg" />
                  </span>
                  <div className="event-meta__text">
                    <span className="event-meta__label">Fecha y hora</span>
                    <span className="event-meta__value">
                      {formatDate(event.date)}
                      <span className="event-meta__sep">·</span>
                      {event.time}
                    </span>
                  </div>
                </div>
                <div className="event-meta__item">
                  <span className="event-meta__icon-wrap" aria-hidden>
                    <IconCheckoutLocation className="event-meta__svg" />
                  </span>
                  <div className="event-meta__text">
                    <span className="event-meta__label">Lugar</span>
                    <span className="event-meta__value">
                      {event.venue?.name?.trim() || "Por confirmar"}
                      <span className="event-meta__city">
                        <span className="event-meta__sep">·</span>
                        {event.city}
                      </span>
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="order-summary">
            <h3>Detalles del pedido</h3>

            <div className="order-item">
              <div className="item-info">
                <span className="item-name">{sectionName || "Entrada general"}</span>
                <span className="item-quantity">x{quantity}</span>
              </div>
              <span className="item-price">
                {formatPrice(unitPrice)}
              </span>
            </div>

            <div className="order-total">
              <div className="quantity-input">
                <div className="quantity-controls">
                  <CustomInput
                    type="number"
                    label="Cantidad de entradas"
                    value={quantity === 0 ? "" : quantity}
                    onChange={handleQuantityChange}
                    placeholder="1"
                    className="ticket-quantity-input"
                  />
                  <SecondaryButton
                    type="button"
                    className="quantity-btn quantity-increase"
                    onClick={() => setQuantity(quantity + 1)}
                    size="small"
                  >
                    +
                  </SecondaryButton>
                  <SecondaryButton
                    type="button"
                    className="quantity-btn quantity-decrease"
                    onClick={() => setQuantity(Math.max(1, quantity - 1))}
                    disabled={quantity <= 1}
                    size="small"
                  >
                    −
                  </SecondaryButton>
                </div>
              </div>

              <div className="total-line">
                <span className="total-label">Subtotal:</span>
                <span className="total-value">
                  {formatPrice(calculateSubtotal())}
                </span>
              </div>
              {calculateFees() > 0 && (
                <div className="total-line">
                  <span className="total-label">{feeLineDescription()}:</span>
                  <span className="total-value">
                    {formatPrice(calculateFees())}
                  </span>
                </div>
              )}
              <div className="total-line final-total">
                <span className="total-label">Total:</span>
                <span className="total-value">
                  {formatPrice(calculateTotal())}
                </span>
              </div>
            </div>
          </div>

          {/* Payment Method Selection - Only show for paid events */}
          {event && unitPrice > 0 && (
            <div className="payment-method-selection">
              <h3>Método de pago</h3>
              <div className="payment-options">
                <label
                  className={`payment-option ${paymentMethod === "mercadopago" ? "selected" : ""}`}
                >
                  <input
                    type="radio"
                    name="paymentMethod"
                    value="mercadopago"
                    checked={paymentMethod === "mercadopago"}
                    onChange={(e) =>
                      setPaymentMethod(
                        e.target.value as "mercadopago" | "whatsapp"
                      )
                    }
                  />
                  <div className="payment-option-content">
                    <span className="payment-option-title payment-option-title--with-icon">
                      <IconCheckoutPayOnline className="payment-option-title__svg" />
                      Pagar en línea
                    </span>
                    <span className="payment-option-description">
                      Pago seguro con tarjeta de crédito/débito o PSE
                    </span>
                  </div>
                </label>

                <label
                  className={`payment-option ${paymentMethod === "whatsapp" ? "selected" : ""}`}
                  style={{ display: "none" }}
                >
                  <input
                    type="radio"
                    name="paymentMethod"
                    value="whatsapp"
                    checked={paymentMethod === "whatsapp"}
                    onChange={(e) =>
                      setPaymentMethod(
                        e.target.value as "mercadopago" | "whatsapp"
                      )
                    }
                  />
                  <div className="payment-option-content">
                    <span className="payment-option-title">📱 WhatsApp</span>
                    <span className="payment-option-description">
                      Reserva vía WhatsApp
                    </span>
                  </div>
                </label>
              </div>
            </div>
          )}

          {/* Error Message */}
          {error && <div className="error-message">{error}</div>}

          {!isAuthenticated && (
            <div className="guest-checkout">
              <h3>Comprar sin cuenta</h3>
              <p className="guest-checkout__hint">
                Recibirás el comprobante y el boleto en el correo que indiques. También puedes{" "}
                <button type="button" className="guest-checkout__link" onClick={() => navigate("/crear-cuenta")}>
                  crear cuenta
                </button>{" "}
                para ver tus tickets en la app.
              </p>
              <CustomInput
                type="email"
                label="Correo electrónico"
                value={guestEmail}
                onChange={(e) => setGuestEmail(e.target.value)}
                placeholder="tu@correo.com"
              />
              <CustomInput
                type="text"
                label="Nombre completo"
                value={guestName}
                onChange={(e) => setGuestName(e.target.value)}
                placeholder="Como aparece en tu documento"
              />
              <div className="guest-checkout__auth-links">
                <SecondaryButton size="small" onClick={() => navigate("/iniciar-sesion")}>
                  Ya tengo cuenta
                </SecondaryButton>
              </div>
            </div>
          )}
          <div className="checkout-actions">
          <PrimaryButton onClick={handlePayment} disabled={isButtonDisabled()}>
            {getButtonText()}
          </PrimaryButton>

          <SecondaryButton onClick={handleGoBack}>
            Volver al evento
          </SecondaryButton>
        </div>
        </div>
      </div>
    </div>
  );
};

export default CheckoutScreen;
