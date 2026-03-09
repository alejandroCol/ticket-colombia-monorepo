import React from 'react';
import type { Ticket } from '@services/types';
import type { Timestamp } from 'firebase/firestore';
import './index.scss';

interface TicketCardProps {
  ticket: Ticket;
  onShowQR?: (ticket: Ticket) => void;
}

const TicketCard: React.FC<TicketCardProps> = ({ ticket, onShowQR }) => {
  const getStatusClass = (status: Ticket['ticketStatus']) => {
    switch (status) {
      case 'paid': return 'status-paid';
      case 'reserved': return 'status-reserved';
      case 'cancelled': return 'status-cancelled';
      case 'used': return 'status-used';
      case 'redeemed': return 'status-redeemed';
      default: return '';
    }
  };
  
  const getStatusLabel = (status: Ticket['ticketStatus']) => {
    switch (status) {
      case 'paid': return 'Pagado';
      case 'reserved': return 'Reservado';
      case 'cancelled': return 'Cancelado';
      case 'used': return 'Usado';
      case 'redeemed': return 'Validado';
      default: return status;
    }
  };

  const getPaymentStatusClass = (status: Ticket['paymentStatus']) => {
    switch (status) {
      case 'approved': return 'payment-approved';
      case 'pending': return 'payment-pending';
      case 'rejected': return 'payment-rejected';
      default: return '';
    }
  };

  const getPaymentStatusLabel = (status: Ticket['paymentStatus']) => {
    switch (status) {
      case 'approved': return 'Aprobado';
      case 'pending': return 'Pendiente';
      case 'rejected': return 'Rechazado';
      default: return status;
    }
  };

  const formatAmount = (amount: number, currency: string) => {
    return new Intl.NumberFormat('es-CO', {
      style: 'currency',
      currency: currency,
      minimumFractionDigits: 0,
    }).format(amount);
  };

  const formatDate = (timestamp: Timestamp | Date | string | number) => {
    if (!timestamp) return '';
    
    let date: Date;
    // Check if it's a Firestore Timestamp
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

  const canShowQR = ticket.ticketStatus === 'paid' && ticket.qrCode;

  return (
    <div className={`ticket-card ${getStatusClass(ticket.ticketStatus)}`}>
      <div className="ticket-header">
        <div className="status-badges">
          <span className={`ticket-status ${getStatusClass(ticket.ticketStatus)}`}>
            {getStatusLabel(ticket.ticketStatus)}
          </span>
          <span className={`payment-status ${getPaymentStatusClass(ticket.paymentStatus)}`}>
            {getPaymentStatusLabel(ticket.paymentStatus)}
          </span>
        </div>
        <div className="ticket-amount">
          {formatAmount(ticket.price || ticket.amount || 0, ticket.currency || 'COP')}
        </div>
      </div>
      
      <div className="ticket-body">
        <h3 className="event-name">{ticket.metadata?.eventName || 'Evento'}</h3>
        {ticket.sectionName && (
          <div className="section-name-display">
            🎫 {ticket.sectionName}
          </div>
        )}
        <div className="ticket-details">
          <div className="detail-row">
            <span className="detail-label">Cantidad:</span>
            <span className="detail-value">{ticket.quantity}</span>
          </div>
          {ticket.metadata?.seatNumber && (
            <div className="detail-row">
              <span className="detail-label">Asiento:</span>
              <span className="detail-value">{ticket.metadata.seatNumber}</span>
            </div>
          )}
          <div className="detail-row">
            <span className="detail-label">Comprador:</span>
            <span className="detail-value">{ticket.buyerName || ticket.metadata?.userName || 'N/A'}</span>
          </div>
          <div className="detail-row">
            <span className="detail-label">Fecha de compra:</span>
            <span className="detail-value">{formatDate(ticket.createdAt)}</span>
          </div>
          {ticket.paymentMethod && (
            <div className="detail-row">
              <span className="detail-label">Método de pago:</span>
              <span className="detail-value">{ticket.paymentMethod.toUpperCase()}</span>
            </div>
          )}
        </div>
      </div>
      
      <div className="ticket-footer">
        <div className="preference-id">
          <span className="code-label">ID:</span>
          <span className="code-value">{ticket.preferenceId?.split('-')[0] || ticket.id.substring(0, 8)}</span>
        </div>
        
        {canShowQR ? (
          <button 
            className="show-qr-btn primary"
            onClick={() => onShowQR?.(ticket)}
          >
            Ver QR
          </button>
        ) : (
          <button 
            className="show-qr-btn disabled"
            disabled
          >
            {ticket.ticketStatus === 'paid' ? 'QR no disponible' : 
             ticket.ticketStatus === 'redeemed' ? 'QR validado' : 'No disponible'}
          </button>
        )}
      </div>
    </div>
  );
};

export default TicketCard; 