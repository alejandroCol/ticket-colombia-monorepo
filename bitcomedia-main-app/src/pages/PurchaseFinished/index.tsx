import React, { useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import PrimaryButton from '../../components/PrimaryButton';
import WhatsAppButton from '../../components/WhatsAppButton';
import { metaPixel } from '../../services';
import './index.scss';

const PurchaseFinished: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  
  // Obtener parámetros de la URL
  const eventSlug = searchParams.get('event');
  const value = searchParams.get('value');

  useEffect(() => {
    // Trackear evento de Purchase en Meta Pixel
    if (eventSlug && value) {
      const purchaseValue = parseFloat(value);
      if (!isNaN(purchaseValue)) {
        metaPixel.trackPurchase(eventSlug, purchaseValue, 1);
      }
    }
  }, [eventSlug, value]);

  const handleGoToTickets = () => {
    navigate('/tickets');
  };

  // Generar mensaje para WhatsApp
  const whatsappMessage = `Hola, necesito ayuda con mi compra reciente.${eventSlug ? `\n\n🎭 Evento: ${eventSlug}` : ''}`;

  return (
    <div className="purchase-finished">
      <div className="purchase-finished__container">
        <div className="purchase-finished__content">
          {/* Icono de éxito */}
          <div className="purchase-finished__icon">
            <svg width="80" height="80" viewBox="0 0 80 80" fill="none" xmlns="http://www.w3.org/2000/svg">
              <circle cx="40" cy="40" r="40" fill="#F57826"/>
              <path d="M25 40L35 50L55 30" stroke="#FFFFFF" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </div>

          {/* Mensaje principal */}
          <h1 className="purchase-finished__title">
            ¡Gracias por tu compra!
          </h1>

          {/* Mensaje de procesamiento */}
          <p className="purchase-finished__processing">
            Tu pago está siendo procesado.
          </p>

          {/* Mensaje de invitación */}
          <p className="purchase-finished__invitation">
            Puedes revisar el estado de tu compra en la sección "Mis tickets".
          </p>

          {/* Botón para ir a tickets */}
          <div className="purchase-finished__button">
            <PrimaryButton 
              onClick={handleGoToTickets}
              size="large"
              fullWidth
            >
              Ver mis tickets
            </PrimaryButton>
          </div>

          {/* Información adicional */}
          <div className="purchase-finished__info">
            <p>
              Si tienes alguna pregunta o necesitas ayuda, no dudes en contactarnos por{' '}
              <WhatsAppButton 
                message={whatsappMessage}
                eventName={eventSlug || undefined}
                trackingLabel="purchase-finished"
              >
                WhatsApp
              </WhatsAppButton>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PurchaseFinished;
