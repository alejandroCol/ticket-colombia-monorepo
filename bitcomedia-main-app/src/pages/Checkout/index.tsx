import React, { useEffect, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import {
  getEventBySlug,
  getPaymentConfig,
  getCurrentUser,
  getUserData,
  createTicket,
  metaPixel,
} from "../../services";
import type { Event, UserData, TicketData } from "../../services";
import { useContactConfig } from "../../contexts/ContactConfigContext";
import TopNavBar from "../../containers/TopNavBar";
import Loader from "../../components/Loader";
import PrimaryButton from "../../components/PrimaryButton";
import SecondaryButton from "../../components/SecondaryButton";
import CustomInput from "../../components/CustomInput";
import "./index.scss";

const CheckoutScreen: React.FC = () => {
  const { whatsappPhone } = useContactConfig();
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [event, setEvent] = useState<Event | null>(null);
  const [paymentConfig, setPaymentConfig] = useState<{
    fees: number;
  } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [quantity, setQuantity] = useState<number>(1);
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);
  const [userData, setUserData] = useState<UserData | null>(null);
  const [paymentLoading, setPaymentLoading] = useState<boolean>(false);
  const [paymentMethod, setPaymentMethod] = useState<
    "mercadopago" | "whatsapp"
  >("mercadopago");
  const { slug } = useParams<{ slug: string }>();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  // Get initial quantity from URL params
  const initialQuantity = Math.max(
    1,
    parseInt(searchParams.get("quantity") || "1")
  );

  // Efecto para hacer scroll al top cuando el componente se monta
  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  // Initialize quantity from URL params
  useEffect(() => {
    setQuantity(initialQuantity);
  }, [initialQuantity]);

  // Check authentication status
  useEffect(() => {
    const checkAuthStatus = async () => {
      const user = getCurrentUser();

      if (user) {
        setIsAuthenticated(true);
        try {
          const userDataResult = await getUserData(user.uid);
          setUserData(userDataResult);
        } catch (error) {
          console.error("Error al obtener datos del usuario:", error);
        }
      } else {
        setIsAuthenticated(false);
        setUserData(null);
      }
    };

    checkAuthStatus();
  }, []);

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

        // Fetch both event data and payment configuration
        const [eventData, configData] = await Promise.all([
          getEventBySlug(slug),
          getPaymentConfig(),
        ]);

        if (!eventData) {
          setError("Evento no encontrado");
          setIsLoading(false);
          return;
        }

        setEvent(eventData);
        setPaymentConfig(configData);
        setError(null);
        
        // Trackear inicio de checkout cuando se carga la página con evento válido
        if (eventData && quantity > 0) {
          metaPixel.trackInitiateCheckout(eventData.name, calculateTotal(), quantity);
        }
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

  // Calculate subtotal (price * quantity)
  const calculateSubtotal = () => {
    if (!event) return 0;
    return event.ticket_price * quantity;
  };

  // Calculate platform fees (percentage of subtotal)
  const calculateFees = () => {
    if (!event || !paymentConfig) return 0;
    // Only apply fees if the event has a price (not free events)
    // Calculate percentage of subtotal
    const subtotal = calculateSubtotal();
    return event.ticket_price > 0 ? Math.round(subtotal * (paymentConfig.fees / 100)) : 0;
  };

  // Calculate final total (sin impuestos)
  const calculateTotal = () => {
    if (!event || !paymentConfig) return 0;
    const subtotal = calculateSubtotal();
    const fees = calculateFees();
    return subtotal + fees;
  };

  // Handle MercadoPago payment
  const handleMercadoPagoPayment = async () => {
    if (!event || !userData || quantity === 0) return;

    setPaymentLoading(true);
    setError(null);

    try {
      const ticketData: TicketData = {
        userId: userData.uid,
        eventId: event.id,
        amount: calculateTotal(),
        quantity: quantity,
        buyerEmail: userData.email,
        metadata: {
          userName: userData.name || userData.email,
          eventName: event.name,
          eventDate: formatDate(event.date),
          eventTime: event.time,
          venue: event.venue?.name || "Por confirmar",
          city: event.city,
          seatNumber: "General",
        },
      };

      const result = (await createTicket(ticketData)) as { initPoint?: string };

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
      message += `• Tarifa de servicio (${paymentConfig?.fees}%): ${feesText}\n`;
    }

    message += `• Total: ${totalText}\n\n¡Espero su confirmación!`;

    const whatsappUrl = `https://wa.me/${whatsappPhone}?text=${encodeURIComponent(message)}`;

    // Trackear contacto via WhatsApp
    metaPixel.trackContact(event.name);

    window.open(whatsappUrl, "_blank");
  };

  // Handle payment process based on selected method
  const handlePayment = () => {
    // For free events, handle as MercadoPago payment (which creates tickets)
    if (event && event.ticket_price === 0) {
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
    
    // For free events, show different text based on authentication
    if (event && event.ticket_price === 0) {
      return isAuthenticated ? "Reservar ahora" : "¡Crea tu cuenta y reserva!";
    }
    
    if (paymentMethod === "mercadopago") {
      return isAuthenticated
        ? "Pagar en línea"
        : "¡Crea tu cuenta y paga!";
    }
    return "Confirmar reserva";
  };

  const isButtonDisabled = () => {
    return (
      !event ||
      quantity === 0 ||
      paymentLoading ||
      !isAuthenticated
    );
  };

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

  return (
    <div className="checkout-screen">
      <TopNavBar logoOnly={true} />

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
              <h2>{event.name}</h2>
              <div className="event-details">
                <div className="detail-item">
                  <i className="icon date-icon"></i>
                  <span>
                    {formatDate(event.date)} - {event.time}
                  </span>
                </div>
                <div className="detail-item">
                  <i className="icon location-icon"></i>
                  <span>
                    {event.venue?.name || "Ubicación por confirmar"},{" "}
                    {event.city}
                  </span>
                </div>
              </div>
            </div>
          </div>

          <div className="order-summary">
            <h3>Detalles del pedido</h3>

            <div className="order-item">
              <div className="item-info">
                <span className="item-name">Entrada general</span>
                <span className="item-quantity">x{quantity}</span>
              </div>
              <span className="item-price">
                {formatPrice(event.ticket_price)}
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
                  <span className="total-label service-fee-label">
                    Tarifa de servicio ({paymentConfig?.fees}%):
                    <span className="tooltip-container">
                      <span className="info-icon">ℹ️</span>
                      <span className="tooltip">
                        Esta tarifa cubre el mantenimiento de la plataforma, infraestructura tecnológica y nuestro servicio de atención al cliente. ¡Así garantizamos que tu experiencia sea siempre genial! 🎭
                      </span>
                    </span>
                  </span>
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
          {event && event.ticket_price > 0 && (
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
                    <span className="payment-option-title">💳 Pagar en línea</span>
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

          {/* Authentication Warning - Always show when not authenticated */}
          {!isAuthenticated && (
            <div className="auth-warning">
              <div className="auth-warning-content">
                <h3>🎭 ¡Un momento! Necesitas una cuenta</h3>
                <p>
                  {event && event.ticket_price === 0 
                    ? "Para reservar tu entrada gratuita y tener tus tickets siempre a mano, crea tu cuenta gratis. ¡Es más rápido que un one-liner!"
                    : "Para pagar de forma segura y tener tus tickets siempre a mano, crea tu cuenta gratis. ¡Es más rápido que un one-liner!"
                  }
                </p>
                <div className="auth-benefits">
                  {event && event.ticket_price === 0 ? (
                    <>
                      <span>✅ Reserva segura</span>
                      <span>✅ Tickets en tu celular</span>
                      <span>✅ Entrada rápida al evento</span>
                    </>
                  ) : (
                    <>
                      <span>✅ Pago 100% seguro</span>
                      <span>✅ Tickets en tu celular</span>
                      <span>✅ Entrada rápida al evento</span>
                    </>
                  )}
                </div>
              </div>
              <div className="auth-actions">
                <PrimaryButton onClick={() => navigate("/signup")}>
                  Crear cuenta gratis
                </PrimaryButton>
                <SecondaryButton onClick={() => navigate("/login")}>
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
