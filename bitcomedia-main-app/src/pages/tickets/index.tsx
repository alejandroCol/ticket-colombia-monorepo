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
import './index.scss';

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

  useEffect(() => {
    const checkAuthStatus = async () => {
      const user = getCurrentUser();
      
      if (user) {
        setIsAuthenticated(true);
        await loadUserTickets();
      }
      
      setIsLoading(false);
    };
    
    checkAuthStatus();
  }, []);

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
            title="¡Tus tickets están esperando por ti! 🎫" 
            message="Crea tu cuenta para acceder a tus entradas y disfrutar de los mejores eventos sin complicaciones."
            benefits={[
              '🎫 Todos tus tickets en un solo lugar',
              '📱 Código QR listo para escanear',
              '⚡ Entrada súper rápida al evento',
              '🔔 Recordatorios antes del show',
              '🎭 Historial de eventos asistidos'
            ]}
            icon="🎫"
          />
          <div className="bottom-nav-spacer"></div>
        </div>
        
        <BottomNavBar />
      </div>
    );
  }

  return (
    <div className="tickets-screen">
      <TopNavBar isAuthenticated={isAuthenticated} />
      
      <div className="tickets-header">
        <h1>Mis Tickets</h1>
        <SecondaryButton onClick={() => navigate('/')}>
          ← Volver al inicio
        </SecondaryButton>
      </div>

      <div className="tickets-content">
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
              <h3>Aún no tienes tickets</h3>
              <p>Explora eventos disponibles y compra tus entradas</p>
              <PrimaryButton onClick={() => navigate('/')}>
                Explorar eventos
              </PrimaryButton>
            </div>
          </div>
        )}

        {/* Sección de soporte para tickets */}
        {isAuthenticated && (
          <div className="ticket-support-section">
            <div className="ticket-support-content">
              <h3>¿Necesitas ayuda con tus tickets?</h3>
              <p>
                Si tienes dudas sobre tus entradas, problemas con el código QR o necesitas hacer algún reclamo, contáctanos por{' '}
                <WhatsAppButton 
                  message={`Hola, necesito ayuda con mis tickets:\n\n[Describe tu consulta aquí]\n\nGracias!`}
                  trackingLabel="tickets-support"
                >
                  WhatsApp
                </WhatsAppButton>
                {' '}y te ayudaremos rápidamente.
              </p>
            </div>
          </div>
        )}
        
        <div className="bottom-nav-spacer"></div>
      </div>
      
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
