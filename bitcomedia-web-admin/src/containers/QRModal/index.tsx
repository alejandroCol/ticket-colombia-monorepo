import React from 'react';
import type { Ticket } from '@services/types';
import './index.scss';

interface QRModalProps {
  ticket: Ticket | null;
  isOpen: boolean;
  onClose: () => void;
}

const QRModal: React.FC<QRModalProps> = ({ ticket, isOpen, onClose }) => {
  if (!isOpen || !ticket) return null;

  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  const handleDownloadQR = () => {
    if (ticket.qrCode) {
      window.open(ticket.qrCode, '_blank');
    }
  };

  return (
    <div className="qr-modal-backdrop" onClick={handleBackdropClick}>
      <div className="qr-modal">
        <div className="qr-modal-header">
          <h2>Código QR del Ticket</h2>
          <button className="close-btn" onClick={onClose}>
            ×
          </button>
        </div>
        
        <div className="qr-modal-content">
          <div className="event-info">
            <h3>{ticket.metadata?.eventName || 'Evento'}</h3>
            <p>Cantidad: {ticket.quantity}</p>
            {ticket.metadata?.seatNumber && <p>Asiento: {ticket.metadata.seatNumber}</p>}
          </div>
          
          {ticket.qrCode ? (
            <div className="qr-container">
              <div className="qr-code">
                <img 
                  src={`https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(ticket.qrCode)}`}
                  alt="Código QR del ticket"
                  onError={(e) => {
                    const target = e.target as HTMLImageElement;
                    target.style.display = 'none';
                    const parent = target.parentElement;
                    if (parent) {
                      parent.innerHTML = `
                        <div class="qr-fallback">
                          <p>QR no disponible</p>
                          <a href="${ticket.qrCode}" target="_blank" rel="noopener noreferrer">
                            Ver enlace
                          </a>
                        </div>
                      `;
                    }
                  }}
                />
              </div>
              
              <div className="qr-actions">
                <button className="download-btn" onClick={handleDownloadQR}>
                  Abrir enlace
                </button>
                <p className="qr-instructions">
                  Presenta este código QR en el evento para validar tu entrada
                </p>
              </div>
            </div>
          ) : (
            <div className="no-qr">
              <p>Código QR no disponible</p>
              <p>El código QR se generará una vez que el pago sea confirmado</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default QRModal; 