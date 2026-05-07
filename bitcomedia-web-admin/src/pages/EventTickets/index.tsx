import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { collection, query, where, getDocs, doc, updateDoc, getDoc, Timestamp } from 'firebase/firestore';
import { db } from '@services/firebase';
import TopNavBar from '@containers/TopNavBar';
import EventSubNav from '@components/EventSubNav';
import Loader from '@components/Loader';
import PrimaryButton from '@components/PrimaryButton';
import SecondaryButton from '@components/SecondaryButton';
import BulkUploadCortesiasModal from '@components/BulkUploadCortesiasModal';
import {
  getEventOrRecurringById,
  getCurrentUser,
  isSuperAdmin,
  hasAdminAccess,
  getUserData,
  listPartnerGrantsForUser,
  getAnyPartnerGrantForTicketEvent,
  resolveEventCollection,
} from '@services';
import { validateTicket, resendTicketPdfEmail } from '@services/ticketService';
import {
  isTicketCourtesyRow,
  ticketListBuyerIdNumber,
  ticketListBuyerName,
  isAdminTicketRowVisible,
  buildParentBundleInfoMap,
  ticketPerBoletoAmountCOP,
} from '@utils/ticketListDisplay';
import './index.scss';

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
  bundleParentTicketId?: string;
  childTicketIds?: string[];
  passCount?: number;
  metadata?: { userName?: string; buyerIdNumber?: string; buyerPhone?: string };
}

async function collectBundleTicketIdsForEdit(t: Ticket): Promise<string[]> {
  const ids = new Set<string>([t.id]);
  if (t.ticketKind === 'purchase_bundle_parent') {
    const ch = t.childTicketIds;
    if (Array.isArray(ch)) ch.forEach((id) => ids.add(id));
  } else if (t.ticketKind === 'purchase_pass' && t.bundleParentTicketId) {
    ids.add(t.bundleParentTicketId);
    const parentSnap = await getDoc(doc(db, 'tickets', t.bundleParentTicketId));
    const parentData = parentSnap.data() as Ticket | undefined;
    const ch = parentData?.childTicketIds;
    if (Array.isArray(ch)) ch.forEach((id) => ids.add(id));
  }
  return [...ids];
}

const EventTicketsScreen: React.FC = () => {
  const { eventId } = useParams<{ eventId: string }>();
  const navigate = useNavigate();
  const [event, setEvent] = useState<{ name: string; organizer_id?: string } | null>(null);
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
  const [editDialogSaved, setEditDialogSaved] = useState(false);
  const [savingEdit, setSavingEdit] = useState(false);
  const [editSendLoading, setEditSendLoading] = useState(false);
  const [isBulkUploadOpen, setIsBulkUploadOpen] = useState(false);
  const [canEditRows, setCanEditRows] = useState(true);
  const [canBulkCourtesies, setCanBulkCourtesies] = useState(true);
  const [canValidateRow, setCanValidateRow] = useState(true);
  const [canDisableRow, setCanDisableRow] = useState(true);
  const [navPartner, setNavPartner] = useState<{ showScan: boolean; showConfig: boolean }>({
    showScan: true,
    showConfig: true,
  });
  const [showTaquillaNav, setShowTaquillaNav] = useState(false);
  const [eventCollection, setEventCollection] = useState<'events' | 'recurring_events' | null>(null);
  const [showOrganizerExtras, setShowOrganizerExtras] = useState(false);

  const visibleTickets = useMemo(
    () => tickets.filter((t) => isAdminTicketRowVisible(t)),
    [tickets]
  );

  const parentBundleMap = useMemo(
    () => buildParentBundleInfoMap(tickets),
    [tickets]
  );

  const loadEvent = async () => {
    if (!eventId) return;
    try {
      const [eventData, coll] = await Promise.all([
        getEventOrRecurringById(eventId),
        resolveEventCollection(eventId),
      ]);
      setEvent(eventData ? { name: eventData.name, organizer_id: eventData.organizer_id } : null);
      setEventCollection(coll);
    } catch {
      setEvent(null);
      setEventCollection(null);
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

  useEffect(() => {
    const u = getCurrentUser();
    if (!u) return;
    void (async () => {
      const data = await getUserData(u.uid);
      if (data?.role !== 'PARTNER') {
        setNavPartner({ showConfig: true, showScan: true });
        setShowTaquillaNav(true);
        return;
      }
      const grants = await listPartnerGrantsForUser(u.uid);
      const scanAny = grants.some((g) => g.permissions.scan_validate);
      const taquillaAny = grants.some(
        (g) => g.permissions.taquilla_sale || g.permissions.create_tickets
      );
      setNavPartner({ showConfig: false, showScan: scanAny });
      setShowTaquillaNav(taquillaAny);
    })();
  }, []);

  useEffect(() => {
    if (loading || !event || !eventId) return;
    const check = async () => {
      const user = getCurrentUser();
      if (!user) return;
      setShowOrganizerExtras(false);
      const superA = await isSuperAdmin(user.uid);
      if (superA) {
        setShowOrganizerExtras(true);
        setShowTaquillaNav(true);
        setCanEditRows(true);
        setCanBulkCourtesies(true);
        setCanValidateRow(true);
        setCanDisableRow(true);
        return;
      }
      if (event.organizer_id === user.uid) {
        setShowOrganizerExtras(true);
        setShowTaquillaNav(true);
        setCanEditRows(true);
        setCanBulkCourtesies(true);
        setCanValidateRow(true);
        setCanDisableRow(true);
        return;
      }
      const admin = await hasAdminAccess(user.uid);
      if (admin) {
        navigate('/dashboard', { replace: true });
        return;
      }
      const pair = await getAnyPartnerGrantForTicketEvent(user.uid, eventId);
      if (
        !pair ||
        (!pair.grant.permissions.read_tickets && !pair.grant.permissions.scan_validate)
      ) {
        navigate('/dashboard', { replace: true });
        return;
      }
      setCanEditRows(false);
      setCanBulkCourtesies(!!pair.grant.permissions.create_tickets);
      setCanValidateRow(!!pair.grant.permissions.scan_validate);
      setCanDisableRow(false);
      setShowTaquillaNav(
        !!(pair.grant.permissions.create_tickets || pair.grant.permissions.taquilla_sale)
      );
    };
    check();
  }, [event, eventId, loading, navigate]);

  const localidades = useMemo(() => {
    const set = new Set<string>();
    visibleTickets.forEach(t => set.add(t.sectionName || 'General'));
    return Array.from(set).sort();
  }, [visibleTickets]);

  useEffect(() => {
    let filtered = visibleTickets;
    if (searchTerm.trim()) {
      const term = searchTerm.toLowerCase().trim();
      filtered = filtered.filter(t => {
        const id = ticketListBuyerIdNumber(t).toLowerCase();
        const name = ticketListBuyerName(t).toLowerCase();
        const email = (t.buyerEmail || '').toLowerCase();
        return id.includes(term) || name.includes(term) || email.includes(term);
      });
    }
    if (filterLocalidad) filtered = filtered.filter(t => (t.sectionName || 'General') === filterLocalidad);
    if (filterValidado === 'validated') filtered = filtered.filter(t => t.validatedAt);
    else if (filterValidado === 'pending') filtered = filtered.filter(t => !t.validatedAt);
    if (filterCortesias === 'only') filtered = filtered.filter(t => isTicketCourtesyRow(t));
    setFilteredTickets(filtered);
  }, [searchTerm, filterLocalidad, filterValidado, filterCortesias, visibleTickets]);

  const handleEdit = (t: Ticket) => {
    setEditingTicket(t);
    setEditDialogSaved(false);
    setEditFormData({
      buyerName: ticketListBuyerName(t),
      buyerEmail: t.buyerEmail || '',
      buyerPhone: t.buyerPhone || '',
    });
  };

  const handleCancelEdit = () => {
    setEditingTicket(null);
    setEditDialogSaved(false);
  };

  const handleSaveEdit = async () => {
    if (!editingTicket) return;
    setSavingEdit(true);
    try {
      const ids = await collectBundleTicketIdsForEdit(editingTicket);
      const updates = {
        buyerName: editFormData.buyerName,
        buyerEmail: editFormData.buyerEmail,
        buyerPhone: editFormData.buyerPhone || null,
      };
      const metaPatch = { userName: editFormData.buyerName };
      await Promise.all(
        ids.map(async (id) => {
          const ref = doc(db, 'tickets', id);
          const snap = await getDoc(ref);
          const existing = (snap.data()?.metadata as Ticket['metadata']) || {};
          await updateDoc(ref, {
            ...updates,
            metadata: { ...existing, ...metaPatch },
            updatedAt: Timestamp.now(),
          });
        })
      );
      setEditDialogSaved(true);
      loadTickets();
    } catch (err) {
      alert('❌ Error al actualizar');
    } finally {
      setSavingEdit(false);
    }
  };

  const handleSendPdfFromEditDialog = async () => {
    if (!editingTicket) return;
    const email = editFormData.buyerEmail.trim();
    if (!email) {
      alert('Indica un correo de destino');
      return;
    }
    setEditSendLoading(true);
    try {
      const r = await resendTicketPdfEmail({
        ticketId: editingTicket.id,
        recipientEmail: email,
      });
      alert(`✅ PDF enviado a ${r.sentTo}`);
      loadTickets();
    } catch (e: unknown) {
      const msg =
        e && typeof e === 'object' && 'message' in e
          ? String((e as { message?: string }).message)
          : 'Error al enviar';
      alert(`❌ ${msg}`);
    } finally {
      setEditSendLoading(false);
    }
  };

  const handleDisable = async (t: Ticket) => {
    const isDisabled = t.ticketStatus === 'cancelled' || t.ticketStatus === 'disabled';
    if (!window.confirm(`¿${isDisabled ? 'Habilitar' : 'Deshabilitar'} el boleto de ${ticketListBuyerName(t) || 'este comprador'}?`)) return;
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

  const canValidate = (t: Ticket) =>
    !t.validatedAt &&
    t.ticketStatus !== 'cancelled' &&
    t.ticketStatus !== 'disabled' &&
    (t.ticketStatus === 'paid' || t.status === 'approved');

  const handleValidate = async (t: Ticket) => {
    if (!canValidate(t)) return;
    if (!window.confirm(`¿Validar entrada del boleto de ${ticketListBuyerName(t) || t.buyerEmail || 'este comprador'}?`)) return;
    setLoading(true);
    try {
      await validateTicket(t.id);
      alert('✅ Boleto validado');
      loadTickets();
    } catch (err) {
      alert(`❌ ${(err as Error).message || 'Error al validar'}`);
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
  const activeTickets = visibleTickets.filter(isActive);
  const cortesias = activeTickets.filter(t => isTicketCourtesyRow(t));
  const vendidos = activeTickets.filter(t => !isTicketCourtesyRow(t));
  const validados = visibleTickets.filter(t => t.validatedAt).length;

  return (
    <div className="event-tickets-screen">
      <TopNavBar
        logoOnly={true}
        showLogout={true}
        adminNavOptions={{
          showConfig: navPartner.showConfig,
          showScan: navPartner.showScan,
          showTaquilla: showTaquillaNav,
        }}
      />
      {eventId && eventCollection && event && (
        <EventSubNav
          eventId={eventId}
          eventTitle={event.name}
          isRecurring={eventCollection === 'recurring_events'}
          active="tickets"
          showOrganizerExtras={showOrganizerExtras}
        />
      )}
      <div className="event-tickets-content">
        <header className="event-tickets-header">
          <div className="header-title">
            <h1>🎫 Boletos</h1>
            <p>{event?.name || 'Cargando...'}</p>
          </div>
          {canBulkCourtesies && (
            <PrimaryButton onClick={() => setIsBulkUploadOpen(true)}>
              📤 Cargar cortesías Excel
            </PrimaryButton>
          )}
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
                      <th>Precio / boleto</th>
                      <th>Cortesía</th>
                      <th>Email</th>
                      <th>Teléfono</th>
                      <th>Estado</th>
                      <th>Método</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredTickets.map(ticket => (
                      <tr key={ticket.id}>
                        <td>{ticket.validatedAt ? <span className="badge ok">✓ Validado</span> : <span className="badge pending">Pendiente</span>}</td>
                        <td>
                          {canValidateRow && canValidate(ticket) && (
                            <button className="btn-icon validate" onClick={() => handleValidate(ticket)} title="Validar" disabled={loading}>✓</button>
                          )}
                          {canEditRows && (
                            <button className="btn-icon edit" onClick={() => handleEdit(ticket)} title="Editar" disabled={loading}>✏️</button>
                          )}
                          {canDisableRow && (
                            <button className={`btn-icon ${(ticket.ticketStatus === 'cancelled' || ticket.ticketStatus === 'disabled') ? 'enable' : 'disable'}`} onClick={() => handleDisable(ticket)} title={(ticket.ticketStatus === 'cancelled' || ticket.ticketStatus === 'disabled') ? 'Habilitar' : 'Deshabilitar'} disabled={loading}>{(ticket.ticketStatus === 'cancelled' || ticket.ticketStatus === 'disabled') ? '✓' : '✕'}</button>
                          )}
                        </td>
                        <td>{ticket.sectionName || 'General'}</td>
                        <td>{ticketListBuyerIdNumber(ticket) || '—'}</td>
                        <td>{ticketListBuyerName(ticket) || '—'}</td>
                        <td>
                          {isTicketCourtesyRow(ticket) ? (
                            <span className="badge cortesia">Cortesía</span>
                          ) : (
                            `$${ticketPerBoletoAmountCOP(ticket, parentBundleMap).toLocaleString('es-CO')}`
                          )}
                        </td>
                        <td>
                          {isTicketCourtesyRow(ticket)
                            ? ticket.isGeneralCourtesy
                              ? 'Evento general'
                              : ticket.giftedBy
                                ? `Por: ${ticket.giftedBy}`
                                : '—'
                            : '—'}
                        </td>
                        <td>{ticket.buyerEmail || '—'}</td>
                        <td>{ticket.buyerPhone || '—'}</td>
                        <td>{getStatusBadge(ticket.ticketStatus || ticket.status)}</td>
                        <td>{getPaymentBadge(ticket.paymentMethod, ticket.createdByAdmin)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </>
        )}
      </div>

      {editingTicket && canEditRows && (
        <div
          className="event-tickets-dialog-overlay"
          role="dialog"
          aria-modal="true"
          aria-labelledby="edit-ticket-dialog-title"
          onClick={(e) => {
            if (e.target === e.currentTarget) handleCancelEdit();
          }}
        >
          <div className="event-tickets-edit-dialog" onClick={(e) => e.stopPropagation()}>
            <h3 id="edit-ticket-dialog-title">Editar boleto</h3>
            <p className="event-tickets-edit-dialog__locality">
              {editingTicket.sectionName || 'General'}
              {' · '}
              <span className="event-tickets-edit-dialog__id">{editingTicket.id.slice(0, 8)}…</span>
            </p>
            <div className="event-tickets-edit-dialog__form">
              <label className="event-tickets-edit-dialog__field">
                Nombre
                <input
                  value={editFormData.buyerName}
                  onChange={(e) => {
                    setEditFormData((f) => ({ ...f, buyerName: e.target.value }));
                    setEditDialogSaved(false);
                  }}
                  disabled={savingEdit}
                  autoComplete="name"
                />
              </label>
              <label className="event-tickets-edit-dialog__field">
                Correo
                <input
                  type="email"
                  value={editFormData.buyerEmail}
                  onChange={(e) => {
                    setEditFormData((f) => ({ ...f, buyerEmail: e.target.value }));
                    setEditDialogSaved(false);
                  }}
                  disabled={savingEdit}
                  autoComplete="email"
                />
              </label>
              <label className="event-tickets-edit-dialog__field">
                Teléfono
                <input
                  value={editFormData.buyerPhone}
                  onChange={(e) => {
                    setEditFormData((f) => ({ ...f, buyerPhone: e.target.value }));
                    setEditDialogSaved(false);
                  }}
                  disabled={savingEdit}
                  autoComplete="tel"
                />
              </label>
            </div>
            <div className="event-tickets-edit-dialog__actions">
              <SecondaryButton onClick={handleCancelEdit} disabled={savingEdit || editSendLoading}>
                Cerrar
              </SecondaryButton>
              <PrimaryButton onClick={handleSaveEdit} disabled={savingEdit || editSendLoading}>
                {savingEdit ? 'Guardando…' : 'Guardar'}
              </PrimaryButton>
            </div>

            <div className="event-tickets-edit-dialog__divider" />

            <h4 className="event-tickets-edit-dialog__subtitle">Enviar entradas por correo</h4>
            <p className="event-tickets-edit-dialog__hint">
              {editDialogSaved
                ? 'Se envía el PDF con los mismos códigos QR. El correo usado es el indicado arriba.'
                : 'Guarda los cambios primero para poder enviar el PDF.'}
            </p>
            <div className="event-tickets-edit-dialog__send-row">
              <PrimaryButton
                type="button"
                onClick={handleSendPdfFromEditDialog}
                disabled={!editDialogSaved || savingEdit || editSendLoading}
              >
                {editSendLoading ? 'Enviando…' : 'Enviar PDF al correo'}
              </PrimaryButton>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default EventTicketsScreen;
