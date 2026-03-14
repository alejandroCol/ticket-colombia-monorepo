import React, { useState, useEffect } from 'react';
import type { Ticket } from '../../services/types';
import { transferTicket } from '../../services';
import CustomInput from '../../components/CustomInput';
import PrimaryButton from '../../components/PrimaryButton';
import SecondaryButton from '../../components/SecondaryButton';
import './index.scss';
import type { CustomStyleProps } from '../../components/types';
import { generateCustomStyles, generateClassName } from '../../components/types';

interface QRModalProps extends CustomStyleProps {
  ticket: Ticket | null;
  isOpen: boolean;
  onClose: () => void;
  onTransferSuccess?: () => void;
  initialShowTransferForm?: boolean;
}

const QRModal: React.FC<QRModalProps> = ({ 
  ticket, 
  isOpen, 
  onClose,
  onTransferSuccess,
  initialShowTransferForm = false,
  theme,
  style,
  cssVariables,
  className,
  grungeEffect: _grungeEffect,
  animated: _animated
}) => {
  const [showTransferForm, setShowTransferForm] = useState(initialShowTransferForm);
  const [recipientEmail, setRecipientEmail] = useState('');
  const [recipientName, setRecipientName] = useState('');
  const [transferring, setTransferring] = useState(false);
  const [transferError, setTransferError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen && initialShowTransferForm) {
      setShowTransferForm(true);
    }
  }, [isOpen, initialShowTransferForm]);

  const customStyles = generateCustomStyles(theme, cssVariables);
  const containerClassName = generateClassName('qr-modal-backdrop', theme, className);
  if (!isOpen || !ticket) return null;

  const canTransfer =
    (ticket.ticketStatus === 'paid' || (ticket as { status?: string }).status === 'approved') &&
    ticket.qrCode &&
    !(ticket as { transferredTo?: string }).transferredTo;

  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  const handleTransferSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!ticket?.id || !recipientEmail.trim()) return;
    setTransferError(null);
    setTransferring(true);
    try {
      await transferTicket(ticket.id, recipientEmail.trim(), recipientName.trim() || undefined);
      setShowTransferForm(false);
      setRecipientEmail('');
      setRecipientName('');
      onTransferSuccess?.();
      onClose();
    } catch (err) {
      setTransferError(err instanceof Error ? err.message : 'Error al transferir');
    } finally {
      setTransferring(false);
    }
  };

  return (
    <div 
      className={containerClassName}
      style={{ ...customStyles, ...style }}
      onClick={handleBackdropClick}
    >
      <div className="qr-modal">
        <div className="qr-modal-header">
          <h2>Código QR del Ticket</h2>
          <button className="close-btn" onClick={onClose}>
            ×
          </button>
        </div>
        
        <div className="qr-modal-content">
          <div className="event-info">
            <h3>{ticket.metadata.eventName}</h3>
            <p>Cantidad: {ticket.quantity}</p>
            <p>Asiento: {ticket.metadata.seatNumber}</p>
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
                <p className="qr-instructions">
                  Presenta este código QR en el evento para validar tu entrada
                </p>
                {canTransfer && (
                  <>
                    {!showTransferForm ? (
                      <SecondaryButton
                        type="button"
                        onClick={() => setShowTransferForm(true)}
                        className="qr-transfer-btn"
                      >
                        Transferir ticket
                      </SecondaryButton>
                    ) : (
                      <form onSubmit={handleTransferSubmit} className="qr-transfer-form">
                        <CustomInput
                          type="email"
                          label="Email del destinatario"
                          value={recipientEmail}
                          onChange={(e) => setRecipientEmail(e.target.value)}
                          placeholder="correo@ejemplo.com"
                          required
                        />
                        <CustomInput
                          type="text"
                          label="Nombre (opcional)"
                          value={recipientName}
                          onChange={(e) => setRecipientName(e.target.value)}
                          placeholder="Nombre del destinatario"
                        />
                        {transferError && <p className="qr-transfer-error">{transferError}</p>}
                        <div className="qr-transfer-btns">
                          <SecondaryButton type="button" onClick={() => setShowTransferForm(false)}>
                            Cancelar
                          </SecondaryButton>
                          <PrimaryButton type="submit" disabled={transferring} loading={transferring}>
                            Transferir
                          </PrimaryButton>
                        </div>
                      </form>
                    )}
                  </>
                )}
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