import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { collection, query, where, getDocs, doc, updateDoc, Timestamp } from 'firebase/firestore';
import { db } from '@services/firebase';
import TopNavBar from '@containers/TopNavBar';
import Loader from '@components/Loader';
import PrimaryButton from '@components/PrimaryButton';
import SecondaryButton from '@components/SecondaryButton';
import BulkUploadCortesiasModal from '@components/BulkUploadCortesiasModal';
import { getEventById } from '@services';
import './index.scss';

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
  isGeneralCourtesy?: boolean;
  giftedBy?: string | null;
}

const EventTicketsScreen: React.FC = () => {
  const { eventId } = useParams<{ eventId: string }>();
  const navigate = useNavigate();
  const [event, setEvent] = useState<{ name: string } | null>(null);
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [filteredTickets, setFilteredTickets] = useState<Ticket[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterLocalidad, setFilterLocalidad] = useState<string>('');
  const [filterValidado, setFilterValidado] = useState<string>('all');
  const [filterCortesias, setFilterCortesias] = useState<string>('all');
  const [editingTicket, setEditingTicket] = useState<Ticket | null>(null);
  const [editFormData, setEditFormData] = useState({ buyerName: '', buyerEmail: '', buyerPhone: '' });
  const [isBulkUploadOpen, setIsBulkUploadOpen] = useState(false);

  const loadEvent = async () => {
    if (!eventId) return;
    try {
      const eventData = await getEventById(eventId);
      setEvent(eventData ? { name: eventData.name } : null);
    } catch {
      setEvent(null);
    }
  };

  const loadTickets = async () => {
    if (!eventId) return;
    setLoading(true);
    setError(null);
    try {
      const ticketsRef = collection(db, 'tickets');
      const q = query(ticketsRef, where('eventId', '==', eventId));
      const querySnapshot = await getDocs(q);
      const ticketsData: Ticket[] = [];
      querySnapshot.forEach((docSnap) => {
        ticketsData.push({ id: docSnap.id, ...docSnap.data() } as Ticket);
      });
      ticketsData.sort((a, b) => (b.createdAt?.toMillis() || 0) - (a.createdAt?.toMillis() || 0));
      setTickets(ticketsData);
      setFilteredTickets(ticketsData);
    } catch (err) {
      console.error('Error loading tickets:', err);
      setError('Error al cargar los boletos.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadEvent();
  }, [eventId]);

  useEffect(() => {
    if (eventId) loadTickets();
  }, [eventId]);

  const localidades = useMemo(() => {
    const set = new Set<string>();
    tickets.forEach(t => set.add(t.sectionName || 'General'));
    return Array.from(set).sort();
  }, [tickets]);

  useEffect(() => {
    let filtered = tickets;
    if (searchTerm.trim()) {
      const term = searchTerm.toLowerCase().trim();
      filtered = filtered.filter(t => {
        const id = (t.buyerIdNumber || '').toLowerCase();
        const name = (t.buyerName || '').toLowerCase();
        const email = (t.buyerEmail || '').toLowerCase();
        return id.includes(term) || name.includes(term) || email.includes(term);
      });
    }
    if (filterLocalidad) filtered = filtered.filter(t => (t.sectionName || 'General') === filterLocalidad);
    if (filterValidado === 'validated') filtered = filtered.filter(t => t.validatedAt);
    else if (filterValidado === 'pending') filtered = filtered.filter(t => !t.validatedAt);
    if (filterCortesias === 'only') filtered = filtered.filter(t => (t.price || 0) === 0);
    setFilteredTickets(filtered);
  }, [searchTerm, filterLocalidad, filterValidado, filterCortesias, tickets]);

  const handleEdit = (t: Ticket) => {
    setEditingTicket(t);
    setEditFormData({ buyerName: t.buyerName || '', buyerEmail: t.buyerEmail || '', buyerPhone: t.buyerPhone || '' });
  };

  const handleCancelEdit = () => {
    setEditingTicket(null);
  };

  const handleSaveEdit = async () => {
    if (!editingTicket) return;
    setLoading(true);
    try {
      await updateDoc(doc(db, 'tickets', editingTicket.id), {
        buyerName: editFormData.buyerName,
        buyerEmail: editFormData.buyerEmail,
        buyerPhone: editFormData.buyerPhone || null
      });
      alert('✅ Boleto actualizado');
      setEditingTicket(null);
      loadTickets();
    } catch (err) {
      alert('❌ Error al actualizar');
    } finally {
      setLoading(false);
    }
  };

  const handleDisable = async (t: Ticket) => {
    const isDisabled = t.ticketStatus === 'cancelled' || t.ticketStatus === 'disabled';
    if (!window.confirm(`¿${isDisabled ? 'Habilitar' : 'Deshabilitar'} el boleto de ${t.buyerName || 'este comprador'}?`)) return;
    setLoading(true);
    try {
      await updateDoc(doc(db, 'tickets', t.id), {
        ticketStatus: isDisabled ? 'paid' : 'disabled',
        updatedAt: Timestamp.now()
      });
      alert(`✅ Boleto ${isDisabled ? 'habilitado' : 'deshabilitado'}`);
      loadTickets();
    } catch (err) {
      alert('❌ Error');
    } finally {
      setLoading(false);
    }
  };

  const getStatusBadge = (status?: string) => {
    const map: Record<string, { label: string; className: string }> = {
      approved: { label: 'Aprobado', className: 'status-approved' },
      pending: { label: 'Pendiente', className: 'status-pending' },
      paid: { label: 'Pagado', className: 'status-approved' },
      cancelled: { label: 'Cancelado', className: 'status-rejected' },
      disabled: { label: 'Deshabilitado', className: 'status-rejected' }
    };
    const info = map[status || ''] || { label: status || '—', className: 'status-unknown' };
    return <span className={`status-badge ${info.className}`}>{info.label}</span>;
  };

  const getPaymentBadge = (method?: string, createdByAdmin?: string) => {
    if (method === 'manual' || createdByAdmin) return <span className="payment-badge payment-manual">Manual</span>;
    if (method?.toLowerCase().includes('mercadopago')) return <span className="payment-badge payment-mercadopago">MercadoPago</span>;
    return <span className="payment-badge payment-other">{method || '—'}</span>;
  };

  if (!eventId) return null;

  const isActive = (t: Ticket) => t.ticketStatus !== 'cancelled' && t.ticketStatus !== 'disabled';
  const activeTickets = tickets.filter(isActive);
  const cortesias = activeTickets.filter(t => (t.price || 0) === 0);
  const vendidos = activeTickets.filter(t => (t.price || 0) > 0);
  const validados = tickets.filter(t => t.validatedAt).length;

  return (
    <div className="event-tickets-screen">
      <TopNavBar logoOnly={true} showLogout={true} />
      <div className="event-tickets-content">
        <header className="event-tickets-header">
          <SecondaryButton onClick={() => navigate('/dashboard')}>← Volver</SecondaryButton>
          <div className="header-title">
            <h1>🎫 Boletos</h1>
            <p>{event?.name || 'Cargando...'}</p>
          </div>
          <PrimaryButton onClick={() => setIsBulkUploadOpen(true)}>
            📤 Cargar cortesías Excel
          </PrimaryButton>
        </header>

        <BulkUploadCortesiasModal
          isOpen={isBulkUploadOpen}
          onClose={() => setIsBulkUploadOpen(false)}
          onSuccess={loadTickets}
          eventId={eventId}
          eventName={event?.name || ''}
        />

        {loading && (
          <div className="event-tickets-loading">
            <Loader size="large" color="accent" />
          </div>
        )}

        {error && <div className="event-tickets-error">⚠️ {error}</div>}

        {!loading && tickets.length === 0 && (
          <div className="event-tickets-empty">
            <p>📭 No hay boletos para este evento</p>
          </div>
        )}

        {!loading && tickets.length > 0 && (
          <>
            <div className="event-tickets-toolbar">
              <div className="summary-cards">
                <div className="summary-card"><span className="label">Total</span><span className="value">{activeTickets.length}</span></div>
                <div className="summary-card vendidos"><span className="label">Vendidos</span><span className="value">{vendidos.length}</span></div>
                <div className="summary-card cortesias"><span className="label">Cortesías</span><span className="value">{cortesias.length}</span></div>
                <div className="summary-card"><span className="label">Validados</span><span className="value">{validados}</span></div>
              </div>
              <div className="filters-row">
                <input
                  type="text"
                  placeholder="Buscar cédula, nombre, email..."
                  value={searchTerm}
                  onChange={e => setSearchTerm(e.target.value)}
                  className="search-input"
                />
                <select value={filterLocalidad} onChange={e => setFilterLocalidad(e.target.value)} className="filter-select">
                  <option value="">Todas localidades</option>
                  {localidades.map(l => <option key={l} value={l}>{l}</option>)}
                </select>
                <select value={filterValidado} onChange={e => setFilterValidado(e.target.value)} className="filter-select">
                  <option value="all">Todos</option>
                  <option value="validated">✓ Validados</option>
                  <option value="pending">Pendientes</option>
                </select>
                <select value={filterCortesias} onChange={e => setFilterCortesias(e.target.value)} className="filter-select">
                  <option value="all">Todos</option>
                  <option value="only">Solo cortesías</option>
                </select>
              </div>
            </div>

            {filteredTickets.length === 0 ? (
              <div className="event-tickets-empty"><p>🔍 No hay boletos con los filtros aplicados</p></div>
            ) : (
              <div className="event-tickets-table-container">
                <table className="event-tickets-table">
                  <thead>
                    <tr>
                      <th>Validado</th>
                      <th>Acciones</th>
                      <th>Localidad</th>
                      <th>Cédula</th>
                      <th>Nombre</th>
                      <th>Precio</th>
                      <th>Cortesía</th>
                      <th>Email</th>
                      <th>Teléfono</th>
                      <th>Estado</th>
                      <th>Método</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredTickets.map(ticket => (
                      <tr key={ticket.id} className={editingTicket?.id === ticket.id ? 'editing' : ''}>
                        {editingTicket?.id === ticket.id ? (
                          <td colSpan={11}>
                            <div className="edit-form">
                              <h4>Editar boleto</h4>
                              <div className="form-row">
                                <label>Nombre</label>
                                <input value={editFormData.buyerName} onChange={e => setEditFormData(f => ({ ...f, buyerName: e.target.value }))} />
                              </div>
                              <div className="form-row">
                                <label>Email</label>
                                <input type="email" value={editFormData.buyerEmail} onChange={e => setEditFormData(f => ({ ...f, buyerEmail: e.target.value }))} />
                              </div>
                              <div className="form-row">
                                <label>Teléfono</label>
                                <input value={editFormData.buyerPhone} onChange={e => setEditFormData(f => ({ ...f, buyerPhone: e.target.value }))} />
                              </div>
                              <div className="edit-actions">
                                <SecondaryButton onClick={handleCancelEdit}>Cancelar</SecondaryButton>
                                <PrimaryButton onClick={handleSaveEdit}>Guardar</PrimaryButton>
                              </div>
                            </div>
                          </td>
                        ) : (
                          <>
                            <td>{ticket.validatedAt ? <span className="badge ok">✓ Validado</span> : <span className="badge pending">Pendiente</span>}</td>
                            <td>
                              <button className="btn-icon edit" onClick={() => handleEdit(ticket)} title="Editar">✏️</button>
                              <button className={`btn-icon ${(ticket.ticketStatus === 'cancelled' || ticket.ticketStatus === 'disabled') ? 'enable' : 'disable'}`} onClick={() => handleDisable(ticket)} title={(ticket.ticketStatus === 'cancelled' || ticket.ticketStatus === 'disabled') ? 'Habilitar' : 'Deshabilitar'}>{(ticket.ticketStatus === 'cancelled' || ticket.ticketStatus === 'disabled') ? '✓' : '✕'}</button>
                            </td>
                            <td>{ticket.sectionName || 'General'}</td>
                            <td>{ticket.buyerIdNumber || '—'}</td>
                            <td>{ticket.buyerName || '—'}</td>
                            <td>{(ticket.price || 0) === 0 ? <span className="badge cortesia">Cortesía</span> : `$${(ticket.price || 0).toLocaleString('es-CO')}`}</td>
                            <td>{(ticket.price || 0) === 0 ? (ticket.isGeneralCourtesy ? 'Evento general' : ticket.giftedBy ? `Por: ${ticket.giftedBy}` : '—') : '—'}</td>
                            <td>{ticket.buyerEmail || '—'}</td>
                            <td>{ticket.buyerPhone || '—'}</td>
                            <td>{getStatusBadge(ticket.ticketStatus || ticket.status)}</td>
                            <td>{getPaymentBadge(ticket.paymentMethod, ticket.createdByAdmin)}</td>
                          </>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
};

export default EventTicketsScreen;
