import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { getCurrentUser } from '../../services';
import { getCurrentUserTickets } from '../../services/ticketService';
import type { Ticket } from '../../services/types';
import AccountlessState from '../../containers/AccountlessState';
import BottomNavBar from '../../containers/BottomNavBar';
import TopNavBar from '../../containers/TopNavBar';
import TicketCard from '../../containers/TicketCard';
import QRModal from '../../containers/QRModal';
import Loader from '../../components/Loader';
import PrimaryButton from '../../components/PrimaryButton';
import SecondaryButton from '../../components/SecondaryButton';
import WhatsAppButton from '../../components/WhatsAppButton';
import {
  ProfileIconArrowBack,
  ProfileIconTicket,
} from '../../components/ProfileScreenIcons';
import {
  clearMercadoPagoReturnIntent,
  resolvePostMercadoPagoRedirectFromTickets,
} from '../../utils/mpCheckoutReturnIntent';
import './index.scss';

const GUEST_PAY_CONFIRMATION_MESSAGE =
  'Revisa tu correo: te enviamos la confirmación. También puedes crear una cuenta gratuita con el mismo correo para ver el código QR y tus entradas en la app.';

const TicketsScreen: React.FC = () => {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [loadingTickets, setLoadingTickets] = useState<boolean>(false);
  const [selectedTicket, setSelectedTicket] = useState<Ticket | null>(null);
  const [showQRModal, setShowQRModal] = useState<boolean>(false);
  const [openWithTransfer, setOpenWithTransfer] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();

  const loadUserTickets = async () => {
    try {
      setLoadingTickets(true);
      setError(null);
      const userTickets = await getCurrentUserTickets();
      setTickets(userTickets);
    } catch (error) {
      console.error('Error loading tickets:', error);
      setError('Error al cargar los tickets. Por favor, intenta de nuevo.');
    } finally {
      setLoadingTickets(false);
    }
  };

  const handleShowQR = (ticket: Ticket) => {
    setSelectedTicket(ticket);
    setOpenWithTransfer(false);
    setShowQRModal(true);
  };

  const handleTransfer = (ticket: Ticket) => {
    setSelectedTicket(ticket);
    setOpenWithTransfer(true);
    setShowQRModal(true);
  };

  const handleCloseQRModal = () => {
    setShowQRModal(false);
    setSelectedTicket(null);
    setOpenWithTransfer(false);
  };

  const handleRetry = () => {
    loadUserTickets();
  };

  useEffect(() => {
    const checkAuthStatus = async () => {
      const user = getCurrentUser();

      if (user) {
        clearMercadoPagoReturnIntent();
        setIsAuthenticated(true);
        await loadUserTickets();
      } else {
        const target = resolvePostMercadoPagoRedirectFromTickets();
        if (target) {
          navigate(target, { replace: true });
          return;
        }
      }

      setIsLoading(false);
    };

    void checkAuthStatus();
  }, [navigate]);

  if (isLoading) {
    return <Loader fullScreen />;
  }

  // Render navigation bars and accountless state when not authenticated
  if (!isAuthenticated) {
    return (
      <div className="tickets-screen">
        <TopNavBar isAuthenticated={isAuthenticated} />
        
        <div className="tickets-content">
          <AccountlessState
            variant="tickets"
            eyebrow="Mis entradas"
            title="Activa tu cuenta y ve tus boletos aquí"
            message={GUEST_PAY_CONFIRMATION_MESSAGE}
            benefitsTitle="Por qué crear cuenta"
            benefits={[
              'QR y entradas siempre a mano en el celular',
              'Entrada más rápida en taquilla',
              'Historial de compras y eventos',
              'Soporte más ágil si necesitas ayuda',
            ]}
          />
          <div className="bottom-nav-spacer"></div>
        </div>
        
        <BottomNavBar />
      </div>
    );
  }

  const ticketCountLabel =
    tickets.length === 1
      ? '1 entrada en tu cuenta'
      : `${tickets.length} entradas en tu cuenta`;

  return (
    <div className="tickets-screen tickets-screen--authenticated">
      <TopNavBar isAuthenticated={isAuthenticated} />

      <main className="tickets-main">
        <header className="tickets-hero">
          <div className="tickets-hero__toolbar">
            <button
              type="button"
              className="tickets-back-link"
              onClick={() => navigate('/')}
            >
              <ProfileIconArrowBack size={20} />
              <span>Inicio</span>
            </button>
          </div>
          <div className="tickets-hero__layout">
            <div className="tickets-hero__mark" aria-hidden>
              <ProfileIconTicket size={34} />
            </div>
            <div className="tickets-hero__text">
              <p className="tickets-hero__eyebrow">Tus compras</p>
              <h1 className="tickets-hero__title">Mis entradas</h1>
              {!loadingTickets && !error && tickets.length > 0 ? (
                <p className="tickets-hero__meta">{ticketCountLabel}</p>
              ) : !loadingTickets && !error && tickets.length === 0 ? (
                <p className="tickets-hero__meta">
                  Explora eventos y guarda aquí tus boletos
                </p>
              ) : null}
            </div>
          </div>
        </header>

        <div className="tickets-body">
        {loadingTickets ? (
          <div className="loading-container">
            <Loader size="large" />
            <p>Cargando tus tickets...</p>
          </div>
        ) : error ? (
          <div className="error-container">
            <div className="error-message">
              <h3>Error al cargar tickets</h3>
              <p>{error}</p>
              <SecondaryButton onClick={handleRetry}>
                Reintentar
              </SecondaryButton>
            </div>
          </div>
        ) : tickets.length > 0 ? (
          <div className="tickets-grid">
            {tickets.map((ticket) => (
              <TicketCard
                key={ticket.id}
                ticket={ticket}
                onShowQR={handleShowQR}
                onTransfer={handleTransfer}
              />
            ))}
          </div>
        ) : (
          <div className="no-tickets">
            <div className="no-tickets-message">
              <div className="no-tickets-icon">🎫</div>
              <h3>Aún no tienes entradas</h3>
              <p>Explora el marketplace y compra tus boletos; aparecerán aquí.</p>
              <PrimaryButton onClick={() => navigate('/')}>
                Explorar eventos
              </PrimaryButton>
            </div>
          </div>
        )}

        <section className="tickets-support-panel" aria-labelledby="tickets-support-title">
          <h2 id="tickets-support-title" className="tickets-support-panel__title">
            ¿Ayuda con una entrada?
          </h2>
          <p className="tickets-support-panel__text">
            Dudas con el QR, cambios o reembolsos: escríbenos por{' '}
            <WhatsAppButton
              message={`Hola, necesito ayuda con mis entradas:\n\n[Describe tu consulta]\n\nGracias.`}
              trackingLabel="tickets-support"
            >
              WhatsApp
            </WhatsAppButton>
            .
          </p>
        </section>

        <div className="bottom-nav-spacer" />
        </div>
      </main>
      
      <BottomNavBar />
      
      <QRModal
        ticket={selectedTicket}
        isOpen={showQRModal}
        onClose={handleCloseQRModal}
        onTransferSuccess={loadUserTickets}
        initialShowTransferForm={openWithTransfer}
      />
    </div>
  );
};

export default TicketsScreen;
