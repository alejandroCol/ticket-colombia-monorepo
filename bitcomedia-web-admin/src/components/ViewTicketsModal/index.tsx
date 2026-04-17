import React, { useState, useEffect } from 'react';
import { collection, query, where, getDocs, doc, updateDoc, Timestamp } from 'firebase/firestore';
import { db } from '@services/firebase';
import Loader from '@components/Loader';
import PrimaryButton from '@components/PrimaryButton';
import SecondaryButton from '@components/SecondaryButton';
import CustomInput from '@components/CustomInput';
import BulkUploadCortesiasModal from '@components/BulkUploadCortesiasModal';
import {
  isTicketCourtesyRow,
  ticketLineAmountCOP,
  ticketListBuyerIdNumber,
  ticketListBuyerName,
} from '@utils/ticketListDisplay';
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
  amount?: number;
  status?: string;
  paymentMethod?: string;
  ticketStatus?: string;
  sectionName?: string;
  createdAt?: Timestamp;
  validatedAt?: Timestamp | null;
  validatedBy?: string | null;
  createdByAdmin?: string;
  isCourtesy?: boolean;
  isGeneralCourtesy?: boolean;
  giftedBy?: string | null;
  ticketKind?: string;
  metadata?: { userName?: string; buyerIdNumber?: string };
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
  const [filterLocalidad, setFilterLocalidad] = useState<string>('');
  const [filterValidado, setFilterValidado] = useState<string>('all');
  const [filterCortesias, setFilterCortesias] = useState<string>('all');
  const [editingTicket, setEditingTicket] = useState<Ticket | null>(null);
  const [editFormData, setEditFormData] = useState({
    buyerName: '',
    buyerEmail: '',
    buyerPhone: ''
  });
  const [isBulkUploadOpen, setIsBulkUploadOpen] = useState(false);

  useEffect(() => {
    if (isOpen && eventId) {
      loadTickets();
      setSearchTerm('');
      setFilterLocalidad('');
      setFilterValidado('all');
      setFilterCortesias('all');
    }
  }, [isOpen, eventId]);

  // Obtener localidades únicas de los tickets
  const localidades = React.useMemo(() => {
    const set = new Set<string>();
    tickets.forEach(t => set.add(t.sectionName || 'General'));
    return Array.from(set).sort();
  }, [tickets]);

  // Filtrar tickets por búsqueda y filtros
  useEffect(() => {
    let filtered = tickets;

    // Búsqueda por cédula, nombre, email
    if (searchTerm.trim()) {
      const term = searchTerm.toLowerCase().trim();
      filtered = filtered.filter(ticket => {
        const idNumber = ticketListBuyerIdNumber(ticket).toLowerCase();
        const name = ticketListBuyerName(ticket).toLowerCase();
        const email = ticket.buyerEmail?.toLowerCase() || '';
        return idNumber.includes(term) || name.includes(term) || email.includes(term);
      });
    }

    // Filtro por localidad
    if (filterLocalidad) {
      filtered = filtered.filter(t => (t.sectionName || 'General') === filterLocalidad);
    }

    // Filtro por validado
    if (filterValidado === 'validated') {
      filtered = filtered.filter(t => t.validatedAt);
    } else if (filterValidado === 'pending') {
      filtered = filtered.filter(t => !t.validatedAt);
    }

    // Filtro solo cortesías
    if (filterCortesias === 'only') {
      filtered = filtered.filter(t => isTicketCourtesyRow(t));
    }

    setFilteredTickets(filtered);
  }, [searchTerm, filterLocalidad, filterValidado, filterCortesias, tickets]);

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
      buyerName: ticketListBuyerName(ticket),
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
      `¿Estás seguro de que quieres ${action} el boleto de ${ticketListBuyerName(ticket) || 'este comprador'}?`
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
          <div className="modal-header-actions">
            <SecondaryButton
              size="small"
              onClick={() => setIsBulkUploadOpen(true)}
            >
              📤 Cargar cortesías Excel
            </SecondaryButton>
            <button className="close-button" onClick={onClose}>✕</button>
          </div>
        </div>

        <BulkUploadCortesiasModal
          isOpen={isBulkUploadOpen}
          onClose={() => setIsBulkUploadOpen(false)}
          onSuccess={loadTickets}
          eventId={eventId}
          eventName={eventName}
        />

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
              {/* Toolbar: resumen + búsqueda + filtros - siempre visible */}
              <div className="tickets-toolbar">
                {(() => {
                  const isActive = (t: Ticket) =>
                    t.ticketStatus !== 'cancelled' && t.ticketStatus !== 'disabled';
                  const activeTickets = tickets.filter(isActive);
                  const cortesias = activeTickets.filter(t => isTicketCourtesyRow(t));
                  const vendidos = activeTickets.filter(t => !isTicketCourtesyRow(t));
                  const validados = tickets.filter(t => t.validatedAt).length;

                  return (
                    <>
                      <div className="tickets-toolbar-row">
                        <div className="tickets-summary">
                          <div className="summary-item summary-total">
                            <span className="summary-label">Total</span>
                            <span className="summary-value">{activeTickets.length}</span>
                          </div>
                          <div className="summary-item summary-vendidos">
                            <span className="summary-label">Vendidos</span>
                            <span className="summary-value">{vendidos.length}</span>
                          </div>
                          <div className="summary-item summary-cortesias">
                            <span className="summary-label">Cortesías</span>
                            <span className="summary-value">{cortesias.length}</span>
                          </div>
                          <div className="summary-item">
                            <span className="summary-label">Validados</span>
                            <span className="summary-value">{validados}</span>
                          </div>
                        </div>
                      </div>
                      <div className="tickets-toolbar-row tickets-filters-row">
                        <div className="tickets-filters">
                  <CustomInput
                    label=""
                    type="text"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    placeholder="Buscar cédula, nombre, email..."
                  />
                  <div className="filter-group">
                    <label>Localidad</label>
                    <select
                      value={filterLocalidad}
                      onChange={(e) => setFilterLocalidad(e.target.value)}
                      className="filter-select"
                    >
                      <option value="">Todas</option>
                      {localidades.map(loc => (
                        <option key={loc} value={loc}>{loc}</option>
                      ))}
                    </select>
                  </div>
                  <div className="filter-group">
                    <label>Validado</label>
                    <select
                      value={filterValidado}
                      onChange={(e) => setFilterValidado(e.target.value)}
                      className="filter-select"
                    >
                      <option value="all">Todos</option>
                      <option value="validated">✓ Validados</option>
                      <option value="pending">Pendientes</option>
                    </select>
                  </div>
                  <div className="filter-group">
                    <label>Tipo</label>
                    <select
                      value={filterCortesias}
                      onChange={(e) => setFilterCortesias(e.target.value)}
                      className="filter-select"
                    >
                      <option value="all">Todos</option>
                      <option value="only">Solo cortesías</option>
                    </select>
                  </div>
                </div>
                      </div>
                    </>
                  );
                })()}
              </div>

              {!loading && filteredTickets.length === 0 && (
                <div className="empty-state">
                  <p>🔍 No hay boletos con los filtros aplicados</p>
                </div>
              )}

              {/* Área de tabla con scroll independiente */}
              {filteredTickets.length > 0 && (
                <div className="tickets-table-wrapper">
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
                    <th>Cortesía</th>
                    <th>Estado</th>
                    <th>Método Pago</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredTickets.map((ticket) => (
                    <tr key={ticket.id} className={editingTicket?.id === ticket.id ? 'editing' : ''}>
                      {editingTicket?.id === ticket.id ? (
                        <td colSpan={11}>
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
                          <td>{ticketListBuyerIdNumber(ticket) || 'N/A'}</td>
                          <td>{ticketListBuyerName(ticket) || 'N/A'}</td>
                          <td>{ticket.buyerEmail || 'N/A'}</td>
                          <td>{ticket.buyerPhone || 'N/A'}</td>
                          <td>
                            {isTicketCourtesyRow(ticket) ? (
                              <span className="cortesia-badge">Cortesía</span>
                            ) : (
                              `$${ticketLineAmountCOP(ticket).toLocaleString('es-CO')}`
                            )}
                          </td>
                          <td className="cortesia-info">
                            {isTicketCourtesyRow(ticket) ? (
                              ticket.isGeneralCourtesy ? (
                                <span className="cortesia-tag">Evento general</span>
                              ) : ticket.giftedBy ? (
                                <span className="cortesia-tag" title="Regalado por">Por: {ticket.giftedBy}</span>
                              ) : (
                                <span className="cortesia-tag">—</span>
                              )
                            ) : (
                              '—'
                            )}
                          </td>
                          <td>{getStatusBadge(ticket.ticketStatus || ticket.status)}</td>
                          <td>{getPaymentMethodBadge(ticket.paymentMethod, ticket.createdByAdmin)}</td>
                        </>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
                </div>
              )}
            </>
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
                        <h4>{ticketListBuyerName(ticket) || 'Comprador sin nombre'}</h4>
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
                          {isTicketCourtesyRow(ticket) ? (
                            <span className="cortesia-badge">Cortesía</span>
                          ) : (
                            `$${ticketLineAmountCOP(ticket).toLocaleString('es-CO')} COP`
                          )}
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

