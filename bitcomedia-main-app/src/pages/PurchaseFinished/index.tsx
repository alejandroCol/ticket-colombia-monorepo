import React, { useEffect, useMemo } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import PrimaryButton from '../../components/PrimaryButton';
import SecondaryButton from '../../components/SecondaryButton';
import WhatsAppButton from '../../components/WhatsAppButton';
import { metaPixel } from '../../services';
import {
  readMercadoPagoReturnIds,
  resolveMercadoPagoReturnUiState,
} from './mercadopagoReturn';
import { clearMercadoPagoReturnIntent } from '../../utils/mpCheckoutReturnIntent';
import {
  EMBED_MSG_SOURCE,
  EMBED_MSG_VERSION,
  isEmbeddedCheckout,
  postToEmbedParent,
  type EmbedPurchaseStatus,
} from '../../utils/embedBridge';
import './index.scss';
import { isTcGlassUi } from '../../utils/tcEmbedUi';

const PurchaseFinished: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const eventSlug = searchParams.get('event');
  const value = searchParams.get('value');
  const eventName = searchParams.get('name') || '';
  const qty = searchParams.get('qty') || '1';
  const section = searchParams.get('section') || '';
  const isTcGlass = isTcGlassUi(searchParams);
  const isTcEmbed = searchParams.get('tc_embed') === '1';

  const mpUiState = useMemo(
    () => resolveMercadoPagoReturnUiState(searchParams),
    [searchParams]
  );
  const mpIds = useMemo(
    () => readMercadoPagoReturnIds(searchParams),
    [searchParams]
  );

  const formatCOP = (n: number) =>
    new Intl.NumberFormat('es-CO', {
      style: 'currency',
      currency: 'COP',
      minimumFractionDigits: 0,
    }).format(n);

  useEffect(() => {
    clearMercadoPagoReturnIntent();
  }, []);

  useEffect(() => {
    if (mpUiState !== 'approved') {
      return;
    }
    if (eventSlug && value) {
      const purchaseValue = parseFloat(value);
      if (!isNaN(purchaseValue)) {
        metaPixel.trackPurchase(eventSlug, purchaseValue, 1);
      }
    }
  }, [eventSlug, value, mpUiState]);

  useEffect(() => {
    if (!isEmbeddedCheckout()) return;
    const status: EmbedPurchaseStatus =
      mpUiState === 'approved' ||
      mpUiState === 'pending' ||
      mpUiState === 'rejected'
        ? mpUiState
        : 'unknown';
    const amountParsed = value && !isNaN(parseFloat(value)) ? parseFloat(value) : null;
    postToEmbedParent({
      source: EMBED_MSG_SOURCE,
      version: EMBED_MSG_VERSION,
      kind: 'purchase_finished',
      status,
      eventSlug,
      amount: amountParsed,
      qty,
    });
  }, [mpUiState, eventSlug, value, qty]);

  const handleGoToTickets = () => {
    navigate('/tickets');
  };

  const handleGoHome = () => {
    navigate('/');
  };

  const whatsappMessage =
    `Hola, necesito ayuda con mi compra reciente.` +
    (eventName
      ? `\n\n🎭 Evento: ${eventName}`
      : eventSlug
        ? `\n\n🎭 Referencia: ${eventSlug}`
        : '');

  const titleAndLead = (() => {
    switch (mpUiState) {
      case 'approved':
        return {
          title: '¡Pago confirmado!',
          lead: 'La confirmación puede demorar unos minutos.',
        };
      case 'pending':
        return {
          title: 'Pago pendiente',
          lead: 'Puede demorar unos minutos o más según el medio de pago. Te avisamos por correo.',
        };
      case 'rejected':
        return {
          title: 'No se completó el pago',
          lead: 'No se aprobó el cobro. Puedes intentar de nuevo desde el evento u otro medio de pago.',
        };
      default:
        return {
          title: '¡Gracias por tu compra!',
          lead: 'La confirmación puede demorar unos minutos.',
        };
    }
  })();

  const showMpReference =
    mpIds.paymentId || mpIds.preferenceId || mpIds.externalReference;

  return (
    <div
      className={`purchase-finished purchase-finished--mp-${mpUiState}${
        isTcGlass ? ' purchase-finished--tc-glass' : ''
      }${isTcEmbed ? ' purchase-finished--embed' : ''}`}
    >
      <div className="purchase-finished__container">
        <div className="purchase-finished__content">
          <div className="purchase-finished__icon" aria-hidden>
            {mpUiState === 'approved' ? (
              <svg
                width="80"
                height="80"
                viewBox="0 0 80 80"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
                className="purchase-finished__icon-svg purchase-finished__icon-svg--ok"
              >
                <circle cx="40" cy="40" r="40" />
                <path
                  d="M25 40L35 50L55 30"
                  stroke="currentColor"
                  strokeWidth="4"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            ) : mpUiState === 'pending' ? (
              <svg
                width="80"
                height="80"
                viewBox="0 0 80 80"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
                className="purchase-finished__icon-svg purchase-finished__icon-svg--pending"
              >
                <circle cx="40" cy="40" r="40" />
                <path
                  d="M40 24v18l12 8"
                  stroke="currentColor"
                  strokeWidth="3.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            ) : mpUiState === 'rejected' ? (
              <svg
                width="80"
                height="80"
                viewBox="0 0 80 80"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
                className="purchase-finished__icon-svg purchase-finished__icon-svg--fail"
              >
                <circle cx="40" cy="40" r="40" />
                <path
                  d="M52 28L28 52M28 28l24 24"
                  stroke="currentColor"
                  strokeWidth="3.5"
                  strokeLinecap="round"
                />
              </svg>
            ) : (
              <svg
                width="80"
                height="80"
                viewBox="0 0 80 80"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
                className="purchase-finished__icon-svg purchase-finished__icon-svg--neutral"
              >
                <circle cx="40" cy="40" r="40" />
                <path
                  d="M40 26v16M40 50h.01"
                  stroke="currentColor"
                  strokeWidth="3.5"
                  strokeLinecap="round"
                />
              </svg>
            )}
          </div>

          <h1 className="purchase-finished__title">{titleAndLead.title}</h1>

          <p className="purchase-finished__processing">{titleAndLead.lead}</p>

          {(eventName || value) && (
            <div className="purchase-finished__summary">
              {eventName && (
                <p>
                  <strong>Evento:</strong> {eventName}
                </p>
              )}
              <p>
                <strong>Entradas:</strong> {qty}
              </p>
              {section && (
                <p>
                  <strong>Localidad:</strong> {section}
                </p>
              )}
              {value && !isNaN(parseFloat(value)) && parseFloat(value) > 0 && (
                <p>
                  <strong>Total:</strong> {formatCOP(parseFloat(value))}
                </p>
              )}
              {value &&
                !isNaN(parseFloat(value)) &&
                parseFloat(value) === 0 && (
                  <p>
                    <strong>Entrada gratuita</strong>
                  </p>
                )}
            </div>
          )}

          {showMpReference ? (
            <div className="purchase-finished__mp-refs">
              <p className="purchase-finished__mp-refs-title">
                Referencia Mercado Pago
              </p>
              {mpIds.paymentId ? (
                <p>
                  <span className="purchase-finished__mp-refs-label">
                    Pago / cobro:
                  </span>{' '}
                  {mpIds.paymentId}
                </p>
              ) : null}
              {mpIds.preferenceId ? (
                <p>
                  <span className="purchase-finished__mp-refs-label">
                    Preferencia:
                  </span>{' '}
                  <span className="purchase-finished__mp-refs-mono">
                    {mpIds.preferenceId}
                  </span>
                </p>
              ) : null}
              {mpIds.externalReference ? (
                <p>
                  <span className="purchase-finished__mp-refs-label">
                    Ticket / ref. interna:
                  </span>{' '}
                  <span className="purchase-finished__mp-refs-mono">
                    {mpIds.externalReference}
                  </span>
                </p>
              ) : null}
            </div>
          ) : null}

          <p className="purchase-finished__invitation">
            {mpUiState === 'rejected'
              ? 'Puedes volver al inicio y volver a intentar la compra cuando quieras.'
              : 'Si tienes cuenta, revisa Mis entradas. Si compraste sin cuenta, revisa tu correo.'}
          </p>

          <div className="purchase-finished__button">
            {mpUiState === 'rejected' ? (
              <>
                <PrimaryButton
                  onClick={handleGoHome}
                  size="large"
                  fullWidth
                >
                  Volver al inicio
                </PrimaryButton>
                <div className="purchase-finished__button-secondary">
                  <SecondaryButton
                    onClick={handleGoToTickets}
                    size="large"
                    fullWidth
                  >
                    Ir a Mis entradas
                  </SecondaryButton>
                </div>
              </>
            ) : (
              <PrimaryButton
                onClick={handleGoToTickets}
                size="large"
                fullWidth
              >
                Ver mis entradas
              </PrimaryButton>
            )}
          </div>

          <div className="purchase-finished__info">
            <p>
              Si tienes alguna pregunta o necesitas ayuda, escríbenos por{' '}
              <WhatsAppButton
                message={whatsappMessage}
                eventName={eventSlug || undefined}
                trackingLabel="purchase-finished"
              >
                WhatsApp
              </WhatsAppButton>
              .
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PurchaseFinished;
