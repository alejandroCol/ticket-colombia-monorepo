import React, { useState, useEffect } from 'react';
import { collection, query, where, getDocs, doc, updateDoc, Timestamp } from 'firebase/firestore';
import { db } from '@services/firebase';
import Loader from '@components/Loader';
import PrimaryButton from '@components/PrimaryButton';
import SecondaryButton from '@components/SecondaryButton';
import CustomInput from '@components/CustomInput';
import './index.scss';

interface ViewTicketsModalProps {
  isOpen: boolean;
  onClose: () => void;
  eventId: string;
  eventName: string;
}

interface Ticket {
  id: string;
  ticketId?: string;
  buyerName?: string;
  buyerEmail?: string;
  buyerPhone?: string;
  buyerIdNumber?: string;
  price?: number;
  status?: string;
  paymentMethod?: string;
  ticketStatus?: string;
  sectionName?: string;
  createdAt?: Timestamp;
  validatedAt?: Timestamp | null;
  validatedBy?: string | null;
  createdByAdmin?: string;
}

const ViewTicketsModal: React.FC<ViewTicketsModalProps> = ({
  isOpen,
  onClose,
  eventId,
  eventName
}) => {
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [filteredTickets, setFilteredTickets] = useState<Ticket[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [editingTicket, setEditingTicket] = useState<Ticket | null>(null);
  const [editFormData, setEditFormData] = useState({
    buyerName: '',
    buyerEmail: '',
    buyerPhone: ''
  });

  useEffect(() => {
    if (isOpen && eventId) {
      loadTickets();
      setSearchTerm('');
    }
  }, [isOpen, eventId]);

  // Filtrar tickets por búsqueda (cédula, nombre, email)
  useEffect(() => {
    if (!searchTerm.trim()) {
      setFilteredTickets(tickets);
      return;
    }

    const term = searchTerm.toLowerCase().trim();
    const filtered = tickets.filter(ticket => {
      const idNumber = ticket.buyerIdNumber?.toLowerCase() || '';
      const name = ticket.buyerName?.toLowerCase() || '';
      const email = ticket.buyerEmail?.toLowerCase() || '';
      return idNumber.includes(term) || name.includes(term) || email.includes(term);
    });
    setFilteredTickets(filtered);
  }, [searchTerm, tickets]);

  const loadTickets = async () => {
    setLoading(true);
    setError(null);
    try {
      const ticketsRef = collection(db, 'tickets');
      const q = query(ticketsRef, where('eventId', '==', eventId));
      const querySnapshot = await getDocs(q);
      
      const ticketsData: Ticket[] = [];
      querySnapshot.forEach((doc) => {
        ticketsData.push({ id: doc.id, ...doc.data() } as Ticket);
      });
      
      // Ordenar por fecha de creación (más recientes primero)
      ticketsData.sort((a, b) => {
        const aTime = a.createdAt?.toMillis() || 0;
        const bTime = b.createdAt?.toMillis() || 0;
        return bTime - aTime;
      });
      
      setTickets(ticketsData);
      setFilteredTickets(ticketsData);
    } catch (err) {
      console.error('Error loading tickets:', err);
      setError('Error al cargar los boletos. Por favor, intenta de nuevo.');
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = (ticket: Ticket) => {
    setEditingTicket(ticket);
    setEditFormData({
      buyerName: ticket.buyerName || '',
      buyerEmail: ticket.buyerEmail || '',
      buyerPhone: ticket.buyerPhone || ''
    });
  };

  const handleCancelEdit = () => {
    setEditingTicket(null);
    setEditFormData({ buyerName: '', buyerEmail: '', buyerPhone: '' });
  };

  const handleSaveEdit = async () => {
    if (!editingTicket) return;

    setLoading(true);
    try {
      const ticketRef = doc(db, 'tickets', editingTicket.id);
      await updateDoc(ticketRef, {
        buyerName: editFormData.buyerName,
        buyerEmail: editFormData.buyerEmail,
        buyerPhone: editFormData.buyerPhone || null
      });

      alert('✅ Boleto actualizado exitosamente');
      setEditingTicket(null);
      loadTickets();
    } catch (err) {
      console.error('Error updating ticket:', err);
      alert('❌ Error al actualizar el boleto');
    } finally {
      setLoading(false);
    }
  };

  const handleDisable = async (ticket: Ticket) => {
    const isDisabled = ticket.ticketStatus === 'cancelled' || ticket.ticketStatus === 'disabled';
    const action = isDisabled ? 'habilitar' : 'deshabilitar';
    const confirmAction = window.confirm(
      `¿Estás seguro de que quieres ${action} el boleto de ${ticket.buyerName || 'este comprador'}?`
    );

    if (!confirmAction) return;

    setLoading(true);
    try {
      const ticketRef = doc(db, 'tickets', ticket.id);
      await updateDoc(ticketRef, {
        ticketStatus: isDisabled ? 'paid' : 'disabled',
        updatedAt: Timestamp.now()
      });
      alert(`✅ Boleto ${isDisabled ? 'habilitado' : 'deshabilitado'} exitosamente`);
      loadTickets();
    } catch (err) {
      console.error('Error updating ticket status:', err);
      alert(`❌ Error al ${action} el boleto`);
    } finally {
      setLoading(false);
    }
  };

  const getStatusBadge = (status?: string) => {
    if (!status) {
      return <span className="status-badge status-unknown">Desconocido</span>;
    }
    
    const statusMap: Record<string, { label: string; className: string }> = {
      approved: { label: 'Aprobado', className: 'status-approved' },
      pending: { label: 'Pendiente', className: 'status-pending' },
      rejected: { label: 'Rechazado', className: 'status-rejected' },
      refunded: { label: 'Reembolsado', className: 'status-refunded' },
      reserved: { label: 'Reservado', className: 'status-pending' },
      paid: { label: 'Pagado', className: 'status-approved' },
      cancelled: { label: 'Cancelado', className: 'status-rejected' },
      used: { label: 'Usado', className: 'status-unknown' },
      redeemed: { label: 'Validado', className: 'status-approved' },
      disabled: { label: 'Deshabilitado', className: 'status-rejected' }
    };
    
    const statusInfo = statusMap[status] || { label: status, className: 'status-unknown' };
    return <span className={`status-badge ${statusInfo.className}`}>{statusInfo.label}</span>;
  };

  const getPaymentMethodBadge = (method?: string, createdByAdmin?: string) => {
    if (!method) {
      return <span className="payment-badge payment-other">Desconocido</span>;
    }
    if (method === 'manual' || createdByAdmin) {
      return <span className="payment-badge payment-manual">🎫 Manual (Admin)</span>;
    }
    if (method.toLowerCase().includes('mercadopago') || method === 'credit_card' || method === 'debit_card') {
      return <span className="payment-badge payment-mercadopago">💳 MercadoPago</span>;
    }
    return <span className="payment-badge payment-other">{method}</span>;
  };

  const formatDate = (timestamp: Timestamp | null | undefined) => {
    if (!timestamp) return 'N/A';
    try {
      const date = timestamp.toDate();
      return date.toLocaleString('es-CO', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
    } catch {
      return 'N/A';
    }
  };

  if (!isOpen) return null;

  return (
    <div className="view-tickets-modal-overlay" onClick={onClose}>
      <div className="view-tickets-modal-content" onClick={(e) => e.stopPropagation()}>
        {loading && (
          <div className="loader-overlay">
            <Loader />
          </div>
        )}
        
        <div className="modal-header">
          <div>
            <h2>🎫 Boletos del Evento</h2>
            <p className="event-name">{eventName}</p>
          </div>
          <button className="close-button" onClick={onClose}>✕</button>
        </div>

        <div className="modal-body">
          {error && (
            <div className="error-message">
              ⚠️ {error}
            </div>
          )}

          {!loading && tickets.length === 0 && (
            <div className="empty-state">
              <p>📭 No hay boletos para este evento aún</p>
            </div>
          )}

          {tickets.length > 0 && (
            <>
              <div className="tickets-summary">
                <div className="summary-item">
                  <span className="summary-label">Total de Boletos:</span>
                  <span className="summary-value">{tickets.length}</span>
                </div>
                <div className="summary-item">
                  <span className="summary-label">Aprobados:</span>
                  <span className="summary-value">{tickets.filter(t => t.status === 'approved').length}</span>
                </div>
                <div className="summary-item">
                  <span className="summary-label">Validados:</span>
                  <span className="summary-value">{tickets.filter(t => t.validatedAt).length}</span>
                </div>
              </div>

              <div className="search-section">
                <CustomInput
                  label="Buscar por cédula, nombre o email"
                  type="text"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="Ej: 1234567890 o Juan Pérez"
                />
              </div>
            </>
          )}

          {!loading && filteredTickets.length === 0 && tickets.length > 0 && (
            <div className="empty-state">
              <p>🔍 No se encontraron boletos con ese criterio de búsqueda</p>
            </div>
          )}

          {filteredTickets.length > 0 && (
            <div className="tickets-table-container">
              <table className="tickets-table">
                <thead>
                  <tr>
                    <th>Validado</th>
                    <th>Acciones</th>
                    <th>Localidad</th>
                    <th>Cédula</th>
                    <th>Nombre</th>
                    <th>Email</th>
                    <th>Teléfono</th>
                    <th>Precio</th>
                    <th>Estado</th>
                    <th>Método Pago</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredTickets.map((ticket) => (
                    <tr key={ticket.id} className={editingTicket?.id === ticket.id ? 'editing' : ''}>
                      {editingTicket?.id === ticket.id ? (
                        <td colSpan={10}>
                          <div className="edit-form">
                            <h4>✏️ Editar Boleto</h4>
                            <div className="form-group">
                              <label>Nombre:</label>
                              <input
                                type="text"
                                value={editFormData.buyerName}
                                onChange={(e) => setEditFormData({ ...editFormData, buyerName: e.target.value })}
                              />
                            </div>
                            <div className="form-group">
                              <label>Email:</label>
                              <input
                                type="email"
                                value={editFormData.buyerEmail}
                                onChange={(e) => setEditFormData({ ...editFormData, buyerEmail: e.target.value })}
                              />
                            </div>
                            <div className="form-group">
                              <label>Teléfono:</label>
                              <input
                                type="tel"
                                value={editFormData.buyerPhone}
                                onChange={(e) => setEditFormData({ ...editFormData, buyerPhone: e.target.value })}
                              />
                            </div>
                            <div className="edit-actions">
                              <SecondaryButton onClick={handleCancelEdit}>
                                Cancelar
                              </SecondaryButton>
                              <PrimaryButton onClick={handleSaveEdit}>
                                Guardar
                              </PrimaryButton>
                            </div>
                          </div>
                        </td>
                      ) : (
                        <>
                          <td>
                            {ticket.validatedAt ? (
                              <span className="validated-badge">✓ Validado</span>
                            ) : (
                              <span className="not-validated-badge">Pendiente</span>
                            )}
                          </td>
                          <td>
                            <div className="table-actions">
                              <button 
                                className="action-btn edit-btn"
                                onClick={() => handleEdit(ticket)}
                                disabled={loading}
                                title="Editar"
                              >
                                ✏️
                              </button>
                              <button 
                                className={`action-btn ${(ticket.ticketStatus === 'cancelled' || ticket.ticketStatus === 'disabled') ? 'enable-btn' : 'disable-btn'}`}
                                onClick={() => handleDisable(ticket)}
                                disabled={loading}
                                title={(ticket.ticketStatus === 'cancelled' || ticket.ticketStatus === 'disabled') ? 'Habilitar' : 'Deshabilitar'}
                              >
                                {(ticket.ticketStatus === 'cancelled' || ticket.ticketStatus === 'disabled') ? '✓' : '✕'}
                              </button>
                            </div>
                          </td>
                          <td>{ticket.sectionName || 'General'}</td>
                          <td>{ticket.buyerIdNumber || 'N/A'}</td>
                          <td>{ticket.buyerName || 'N/A'}</td>
                          <td>{ticket.buyerEmail || 'N/A'}</td>
                          <td>{ticket.buyerPhone || 'N/A'}</td>
                          <td>${(ticket.price || 0).toLocaleString('es-CO')}</td>
                          <td>{getStatusBadge(ticket.ticketStatus || ticket.status)}</td>
                          <td>{getPaymentMethodBadge(ticket.paymentMethod, ticket.createdByAdmin)}</td>
                        </>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Mantener la lista antigua como fallback para edición */}
          <div className="tickets-list" style={{ display: 'none' }}>
            {filteredTickets.map((ticket) => (
              <div key={ticket.id} className="ticket-item">
                {editingTicket?.id === ticket.id ? (
                  <div className="edit-form">
                    <h4>✏️ Editar Boleto</h4>
                    <div className="form-group">
                      <label>Nombre:</label>
                      <input
                        type="text"
                        value={editFormData.buyerName}
                        onChange={(e) => setEditFormData({ ...editFormData, buyerName: e.target.value })}
                      />
                    </div>
                    <div className="form-group">
                      <label>Email:</label>
                      <input
                        type="email"
                        value={editFormData.buyerEmail}
                        onChange={(e) => setEditFormData({ ...editFormData, buyerEmail: e.target.value })}
                      />
                    </div>
                    <div className="form-group">
                      <label>Teléfono:</label>
                      <input
                        type="tel"
                        value={editFormData.buyerPhone}
                        onChange={(e) => setEditFormData({ ...editFormData, buyerPhone: e.target.value })}
                      />
                    </div>
                    <div className="edit-actions">
                      <SecondaryButton onClick={handleCancelEdit}>
                        Cancelar
                      </SecondaryButton>
                      <PrimaryButton onClick={handleSaveEdit}>
                        Guardar
                      </PrimaryButton>
                    </div>
                  </div>
                ) : (
                  <>
                    <div className="ticket-header">
                      <div className="ticket-info">
                        <h4>{ticket.buyerName || 'Comprador sin nombre'}</h4>
                        <p className="ticket-email">{ticket.buyerEmail || 'Sin email'}</p>
                        {ticket.buyerPhone && <p className="ticket-phone">📱 {ticket.buyerPhone}</p>}
                      </div>
                      <div className="ticket-badges">
                        {getStatusBadge(ticket.status)}
                        {getPaymentMethodBadge(ticket.paymentMethod, ticket.createdByAdmin)}
                      </div>
                    </div>

                    <div className="ticket-details">
                      <div className="detail-item">
                        <span className="detail-label">ID:</span>
                        <span className="detail-value ticket-id">
                          {(ticket.ticketId || ticket.id || 'N/A').substring(0, 12)}...
                        </span>
                      </div>
                      <div className="detail-item">
                        <span className="detail-label">Precio:</span>
                        <span className="detail-value">
                          ${(ticket.price || 0).toLocaleString('es-CO')} COP
                        </span>
                      </div>
                      <div className="detail-item">
                        <span className="detail-label">Creado:</span>
                        <span className="detail-value">{formatDate(ticket.createdAt)}</span>
                      </div>
                      {ticket.validatedAt && (
                        <div className="detail-item">
                          <span className="detail-label">Validado:</span>
                          <span className="detail-value validated">✓ {formatDate(ticket.validatedAt)}</span>
                        </div>
                      )}
                    </div>

                    <div className="ticket-actions">
                      <button 
                        className="action-btn edit-btn"
                        onClick={() => handleEdit(ticket)}
                        disabled={loading}
                      >
                        ✏️ Editar
                      </button>
                      <button 
                        className={`action-btn ${(ticket.ticketStatus === 'cancelled' || ticket.ticketStatus === 'disabled') ? 'enable-btn' : 'disable-btn'}`}
                        onClick={() => handleDisable(ticket)}
                        disabled={loading}
                        title={(ticket.ticketStatus === 'cancelled' || ticket.ticketStatus === 'disabled') ? 'Habilitar' : 'Deshabilitar'}
                      >
                        {(ticket.ticketStatus === 'cancelled' || ticket.ticketStatus === 'disabled') ? '✓ Habilitar' : '✕ Deshabilitar'}
                      </button>
                    </div>
                  </>
                )}
              </div>
            ))}
          </div>
        </div>

        <div className="modal-footer">
          <SecondaryButton onClick={onClose}>
            Cerrar
          </SecondaryButton>
        </div>
      </div>
    </div>
  );
};

export default ViewTicketsModal;

