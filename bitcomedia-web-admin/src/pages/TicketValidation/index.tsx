import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { doc, getDoc } from 'firebase/firestore';
import TopNavBar from '@TopNavBar';
import TicketCard from '@containers/TicketCard';
import Loader from '@components/Loader';
import { logoutUser, db, getCurrentUser, hasAdminAccess } from '@services';
import { getTicketById, validateTicket } from '@services/ticketService';
import type { Ticket, Event } from '@services/types';
import type { Timestamp } from 'firebase/firestore';
import './index.scss';

const TicketValidationScreen: React.FC = () => {
  const { ticketId } = useParams<{ ticketId: string }>();
  const navigate = useNavigate();
  const [ticket, setTicket] = useState<Ticket | null>(null);
  const [event, setEvent] = useState<Event | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [validating, setValidating] = useState(false);
  const [isAdmin, setIsAdmin] = useState<boolean>(false);
  const [authChecking, setAuthChecking] = useState(true);

  // Check admin access
  useEffect(() => {
    const checkAdminAccess = async () => {
      try {
        const currentUser = getCurrentUser();
        if (!currentUser) {
          setError('Usuario no autenticado');
          setAuthChecking(false);
          navigate('/login');
          return;
        }

        const adminAccess = await hasAdminAccess(currentUser.uid);
        if (!adminAccess) {
          setError('No tienes permisos para acceder a esta página');
          setAuthChecking(false);
          await logoutUser();
          navigate('/login');
          return;
        }

        setIsAdmin(true);
        setAuthChecking(false);
      } catch (err) {
        console.error('Error checking admin access:', err);
        setError('Error verificando permisos de administrador');
        setAuthChecking(false);
        navigate('/login');
      }
    };

    checkAdminAccess();
  }, [navigate]);

  // Fetch ticket and event data
  useEffect(() => {
    const fetchTicketData = async () => {
      if (!ticketId || !isAdmin || authChecking) {
        if (!ticketId) {
          setError('ID de ticket no válido');
        }
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        
        // Fetch ticket data
        const ticketData = await getTicketById(ticketId);
        
        if (!ticketData) {
          setError('Ticket no encontrado');
          setLoading(false);
          return;
        }

        setTicket(ticketData);

        // Fetch associated event data
        if (ticketData.eventId) {
          const eventRef = doc(db, 'events', ticketData.eventId);
          const eventSnap = await getDoc(eventRef);
          
          if (eventSnap.exists()) {
            setEvent({
              id: eventSnap.id,
              ...eventSnap.data()
            } as Event);
          }
        }
      } catch (err) {
        console.error('Error fetching ticket data:', err);
        setError('Error al cargar la información del ticket');
      } finally {
        setLoading(false);
      }
    };

    fetchTicketData();
  }, [ticketId, isAdmin, authChecking]);

  const handleLogout = async () => {
    try {
      await logoutUser();
    } catch (error) {
      console.error('Logout error:', error);
    }
  };

  const handleBackToDashboard = () => {
    navigate('/dashboard');
  };

  const handleValidateTicket = async () => {
    if (!ticket || !ticketId || !isAdmin) {
      alert('No tienes permisos para validar tickets');
      return;
    }
    
    try {
      setValidating(true);
      await validateTicket(ticketId);
      
      // Recargar el ticket para obtener los datos actualizados
      const updatedTicket = await getTicketById(ticketId);
      if (updatedTicket) {
        setTicket(updatedTicket);
      }
      
      alert('✅ Ticket validado exitosamente. Este ticket ya no podrá ser usado nuevamente.');
    } catch (error) {
      console.error('Error validating ticket:', error);
      alert(`Error al validar el ticket: ${(error as Error).message}`);
    } finally {
      setValidating(false);
    }
  };

  const formatDate = (timestamp: Timestamp | Date | string | number | null | undefined): string => {
    if (!timestamp) return '';
    
    let date: Date;
    if (timestamp && typeof timestamp === 'object' && 'toDate' in timestamp) {
      date = (timestamp as Timestamp).toDate();
    } else if (timestamp instanceof Date) {
      date = timestamp;
    } else {
      date = new Date(timestamp as string | number);
    }
    
    return new Intl.DateTimeFormat('es-CO', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }).format(date);
  };

  const formatAmount = (amount: number, currency: string) => {
    return new Intl.NumberFormat('es-CO', {
      style: 'currency',
      currency: currency,
      minimumFractionDigits: 0,
    }).format(amount);
  };

  if (authChecking || loading) {
    return (
      <div className="ticket-validation-screen">
        <TopNavBar 
          logoOnly={true} 
          showLogout={true} 
          onLogout={handleLogout}
        />
        <div className="validation-content">
          <div className="loading-container">
            <Loader />
            <p>{authChecking ? 'Verificando permisos...' : 'Cargando información del ticket...'}</p>
          </div>
        </div>
      </div>
    );
  }

  if (error || !ticket) {
    return (
      <div className="ticket-validation-screen">
        <TopNavBar 
          logoOnly={true} 
          showLogout={true} 
          onLogout={handleLogout}
        />
        <div className="validation-content">
          <div className="error-container">
            <h2>Error</h2>
            <p>{error || 'Ticket no encontrado'}</p>
            <button className="back-button" onClick={handleBackToDashboard}>
              Volver al Dashboard
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="ticket-validation-screen">
      <TopNavBar 
        logoOnly={true} 
        showLogout={true} 
        onLogout={handleLogout}
      />
      
      <div className="validation-content">
        <div className="validation-header">
          <button className="back-button" onClick={handleBackToDashboard}>
            ← Volver al Dashboard
          </button>
          <div className="header-content">
            <h1>Validación de Ticket</h1>
            {ticket && (
              <>
                {ticket.validatedAt ? (
                  <div className="validated-status">
                    <span className="validated-badge-large">✓ Validado</span>
                    <p className="validated-date">
                      Validado el {formatDate(ticket.validatedAt)}
                    </p>
                  </div>
                ) : (
                  <button 
                    className="validate-button"
                    onClick={handleValidateTicket}
                    disabled={validating || ticket.ticketStatus === 'used'}
                  >
                    {validating ? 'Validando...' : 'Validar'}
                  </button>
                )}
              </>
            )}
          </div>
        </div>

        <div className="validation-body">
          {/* Ticket Information */}
          <div className="ticket-section">
            <h2>Información del Ticket</h2>
            <TicketCard ticket={ticket} />
          </div>

          {/* Buyer Information */}
          <div className="buyer-section">
            <h2>Información del Comprador</h2>
            <div className="info-card">
              <div className="info-row">
                <span className="info-label">Nombre:</span>
                <span className="info-value">
                  {ticket.buyerName || ticket.metadata?.userName || 'No disponible'}
                </span>
              </div>
              <div className="info-row">
                <span className="info-label">Email:</span>
                <span className="info-value">{ticket.buyerEmail || 'No disponible'}</span>
              </div>
              {ticket.buyerPhone && (
                <div className="info-row">
                  <span className="info-label">Teléfono:</span>
                  <span className="info-value">{ticket.buyerPhone}</span>
                </div>
              )}
              {ticket.userId && (
                <div className="info-row">
                  <span className="info-label">ID de Usuario:</span>
                  <span className="info-value">{ticket.userId}</span>
                </div>
              )}
              {ticket.createdByAdmin && (
                <div className="info-row">
                  <span className="info-label">Tipo:</span>
                  <span className="info-value ticket-manual">🎫 Ticket Manual (Creado por Admin)</span>
                </div>
              )}
            </div>
          </div>

          {/* Event Information */}
          {event && (
            <div className="event-section">
              <h2>Información del Evento</h2>
              <div className="info-card">
                <div className="event-header">
                  {event.cover_image_url && (
                    <img 
                      src={event.cover_image_url} 
                      alt={event.name}
                      className="event-image"
                    />
                  )}
                  <div className="event-details">
                    <h3>{event.name}</h3>
                    <p className="event-description">{event.description}</p>
                  </div>
                </div>
                
                <div className="event-info">
                  <div className="info-row">
                    <span className="info-label">Fecha:</span>
                    <span className="info-value">{event.date}</span>
                  </div>
                  <div className="info-row">
                    <span className="info-label">Hora:</span>
                    <span className="info-value">{event.time}</span>
                  </div>
                  <div className="info-row">
                    <span className="info-label">Ciudad:</span>
                    <span className="info-value">{event.city}</span>
                  </div>
                  {event.venue && (
                    <>
                      <div className="info-row">
                        <span className="info-label">Venue:</span>
                        <span className="info-value">{event.venue.name}</span>
                      </div>
                      <div className="info-row">
                        <span className="info-label">Dirección:</span>
                        <span className="info-value">{event.venue.address}</span>
                      </div>
                    </>
                  )}
                  {ticket.sectionName && (
                    <div className="info-row">
                      <span className="info-label">Localidad:</span>
                      <span className="info-value section-name-large">{ticket.sectionName}</span>
                    </div>
                  )}
                  <div className="info-row">
                    <span className="info-label">Precio por ticket:</span>
                    <span className="info-value">
                      {formatAmount((ticket.price || ticket.amount || event.ticket_price || 0), ticket.currency || 'COP')}
                    </span>
                  </div>
                  <div className="info-row">
                    <span className="info-label">Precio total:</span>
                    <span className="info-value">
                      {formatAmount((ticket.price || ticket.amount || 0) * (ticket.quantity || 1), ticket.currency || 'COP')}
                    </span>
                  </div>
                  <div className="info-row">
                    <span className="info-label">Capacidad:</span>
                    <span className="info-value">{event.capacity_per_occurrence} personas</span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Payment Information */}
          <div className="payment-section">
            <h2>Información de Pago</h2>
            <div className="info-card">
              <div className="info-row">
                <span className="info-label">Monto Total:</span>
                <span className="info-value">
                  {formatAmount((ticket.price || ticket.amount || 0) * (ticket.quantity || 1), ticket.currency || 'COP')}
                </span>
              </div>
              <div className="info-row">
                <span className="info-label">Cantidad:</span>
                <span className="info-value">{ticket.quantity} ticket(s)</span>
              </div>
              <div className="info-row">
                <span className="info-label">Estado del Pago:</span>
                <span className={`info-value payment-status ${ticket.paymentStatus}`}>
                  {ticket.paymentStatus === 'approved' ? 'Aprobado' : 
                   ticket.paymentStatus === 'pending' ? 'Pendiente' : 'Rechazado'}
                </span>
              </div>
              {ticket.paymentMethod && (
                <div className="info-row">
                  <span className="info-label">Método de Pago:</span>
                  <span className="info-value">{ticket.paymentMethod.toUpperCase()}</span>
                </div>
              )}
              {ticket.paymentId && (
                <div className="info-row">
                  <span className="info-label">ID de Pago:</span>
                  <span className="info-value">{ticket.paymentId}</span>
                </div>
              )}
              <div className="info-row">
                <span className="info-label">Fecha de Creación:</span>
                <span className="info-value">{formatDate(ticket.createdAt)}</span>
              </div>
              <div className="info-row">
                <span className="info-label">Última Actualización:</span>
                <span className="info-value">{formatDate(ticket.updatedAt)}</span>
              </div>
            </div>
          </div>

          {/* QR Code Information */}
          {ticket.qrCode && (
            <div className="qr-section">
              <h2>Código QR</h2>
              <div className="info-card">
                <div className="info-row">
                  <span className="info-label">URL del QR:</span>
                  <span className="info-value qr-url">{ticket.qrCode}</span>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default TicketValidationScreen;
