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
import { validateTicket, resendTicketPdfEmail, confirmManualTicketPayment, releaseReservedTicket, isTicketReservedHold, sumSoldEntradaUnitsForAdminStats } from '@services/ticketService';
import {
  isTicketCourtesyRow,
  ticketDocUnits,
  ticketListBuyerIdNumber,
  ticketListBuyerName,
  isAdminTicketRowVisible,
  buildParentBundleInfoMap,
  ticketPerBoletoAmountCOP,
} from '@utils/ticketListDisplay';
import {
  resolveTicketLocality,
  isTicketAbonoRow,
  isTicketAbonoCompleted,
  isTicketCheckoutHold,
  eventSupportsAbono,
} from '@utils/ticketDisplay';
import { palcoCellsForSection, mapZoneDisplayLabel } from '@utils/venueMapSection';
import type { Ticket as ServiceTicket, Event, VenueMapZone } from '@services/types';
import { exportEventClientsToExcel, ticketsForClientExport } from '@utils/exportEventClientsExcel';
import { exportEventBoleteriaToExcel, ticketsForBoleteriaExport } from '@utils/exportEventBoleteriaExcel';
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
  sectionId?: string;
  mapZoneId?: string;
  installmentPhase?: string;
  totalPurchaseCOP?: number;
  depositCOP?: number;
  balanceCOP?: number;
  balanceDueAt?: Timestamp;
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
  quantity?: number;
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
  const [event, setEvent] = useState<Pick<Event, 'name' | 'organizer_id' | 'venue_map' | 'sections' | 'abono_min_percent' | 'abono_min_amount_cop'> | null>(null);
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [filteredTickets, setFilteredTickets] = useState<Ticket[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterLocalidad, setFilterLocalidad] = useState<string>('');
  const [filterPalco, setFilterPalco] = useState<string>('');
  const [filterValidado, setFilterValidado] = useState<string>('all');
  const [filterCortesias, setFilterCortesias] = useState<string>('all');
  const [filterAbono, setFilterAbono] = useState<string>('all');
  const [confirmingPaymentId, setConfirmingPaymentId] = useState<string | null>(null);
  const [releasingHoldId, setReleasingHoldId] = useState<string | null>(null);
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

  const operativeVisibleTickets = useMemo(
    () => visibleTickets.filter((t) => !isTicketReservedHold(t)),
    [visibleTickets]
  );

  const venueMap = event?.venue_map;

  const ticketLocality = (t: Ticket) => resolveTicketLocality(t, venueMap);

  const matchesSearch = (t: Ticket, term: string) => {
    const id = ticketListBuyerIdNumber(t).toLowerCase();
    const name = ticketListBuyerName(t).toLowerCase();
    const email = (t.buyerEmail || '').toLowerCase();
    return id.includes(term) || name.includes(term) || email.includes(term);
  };

  const matchesLocalityFilters = (t: Ticket) => {
    const loc = ticketLocality(t);
    if (filterLocalidad && loc.sectionName !== filterLocalidad) return false;
    if (filterPalco && loc.palcoFilterKey !== filterPalco) return false;
    return true;
  };

  const reservedTicketsFiltered = useMemo(() => {
    let list = visibleTickets.filter(isTicketCheckoutHold);
    if (searchTerm.trim()) {
      const term = searchTerm.toLowerCase().trim();
      list = list.filter((t) => matchesSearch(t, term));
    }
    if (filterLocalidad || filterPalco) list = list.filter(matchesLocalityFilters);
    return list;
  }, [visibleTickets, searchTerm, filterLocalidad, filterPalco, venueMap]);

  const abonoEnabled = eventSupportsAbono(event);

  const abonoTicketsFiltered = useMemo(() => {
    let list = visibleTickets.filter(isTicketAbonoRow);
    if (searchTerm.trim()) {
      const term = searchTerm.toLowerCase().trim();
      list = list.filter((t) => matchesSearch(t, term));
    }
    if (filterLocalidad || filterPalco) list = list.filter(matchesLocalityFilters);
    return list;
  }, [visibleTickets, searchTerm, filterLocalidad, filterPalco, venueMap]);

  const abonoCompletadosCount = useMemo(
    () => visibleTickets.filter(isTicketAbonoCompleted).length,
    [visibleTickets]
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
      setEvent(eventData ? {
        name: eventData.name,
        organizer_id: eventData.organizer_id,
        venue_map: eventData.venue_map,
        sections: eventData.sections,
        abono_min_percent: eventData.abono_min_percent,
        abono_min_amount_cop: eventData.abono_min_amount_cop,
      } : null);
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
      const vis = ticketsData.filter(isAdminTicketRowVisible);
      setFilteredTickets(vis.filter((t) => !isTicketReservedHold(t)));
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
    const add = (t: Ticket) => set.add(ticketLocality(t).sectionName);
    operativeVisibleTickets.forEach(add);
    visibleTickets.filter(isTicketCheckoutHold).forEach(add);
    visibleTickets.filter(isTicketAbonoRow).forEach(add);
    return Array.from(set).sort();
  }, [operativeVisibleTickets, visibleTickets, venueMap]);

  const palcosFilterOptions = useMemo(() => {
    const set = new Set<string>();
    const zones = venueMap?.zones || [];
    zones.forEach((z: VenueMapZone) => {
      if (z.palco_index != null || zones.filter((x) => x.sectionId === z.sectionId).length > 1) {
        set.add(`Palco ${mapZoneDisplayLabel(z)}`);
      }
    });
    (event?.sections || []).forEach((sec) => {
      palcoCellsForSection(zones, sec.id).forEach((z) => {
        set.add(`Palco ${mapZoneDisplayLabel(z)}`);
      });
    });
    visibleTickets.forEach((t) => {
      const key = ticketLocality(t).palcoFilterKey;
      if (key) set.add(key);
    });
    return Array.from(set).sort((a, b) => {
      const na = parseInt(a.replace(/\D/g, ''), 10);
      const nb = parseInt(b.replace(/\D/g, ''), 10);
      if (!Number.isNaN(na) && !Number.isNaN(nb) && na !== nb) return na - nb;
      return a.localeCompare(b, 'es');
    });
  }, [visibleTickets, venueMap, event?.sections]);

  useEffect(() => {
    let filtered = operativeVisibleTickets;
    if (searchTerm.trim()) {
      const term = searchTerm.toLowerCase().trim();
      filtered = filtered.filter((t) => matchesSearch(t, term));
    }
    if (filterLocalidad || filterPalco) filtered = filtered.filter(matchesLocalityFilters);
    if (filterValidado === 'validated') filtered = filtered.filter(t => t.validatedAt);
    else if (filterValidado === 'pending') filtered = filtered.filter(t => !t.validatedAt);
    if (filterCortesias === 'only') filtered = filtered.filter(t => isTicketCourtesyRow(t));
    if (filterAbono === 'pending') filtered = filtered.filter(t => isTicketAbonoRow(t));
    else if (filterAbono === 'completed') filtered = filtered.filter(t => isTicketAbonoCompleted(t));
    else if (filterAbono === 'full') filtered = filtered.filter(t => !isTicketAbonoRow(t) && !isTicketAbonoCompleted(t));
    setFilteredTickets(filtered);
  }, [searchTerm, filterLocalidad, filterPalco, filterValidado, filterCortesias, filterAbono, operativeVisibleTickets, venueMap]);

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

  const handleConfirmManualPayment = async (t: Ticket) => {
    const phase = t.installmentPhase || 'none';
    const isDeposit = phase === 'awaiting_deposit';
    const msg = isDeposit
      ? `¿Confirmar que recibiste el abono inicial de ${ticketListBuyerName(t) || 'este comprador'}? Se enviará el correo con el enlace para completar el saldo.`
      : phase === 'deposit_paid' || phase === 'awaiting_balance'
        ? `¿Confirmar que recibiste el saldo pendiente de ${ticketListBuyerName(t) || 'este comprador'}? Se generarán los QR y se enviarán las entradas por correo.`
        : `¿Confirmar que recibiste el pago de ${ticketListBuyerName(t) || 'este comprador'} por otro medio? Se generarán los QR y se enviarán las entradas por correo.`;
    if (!window.confirm(msg)) return;
    setConfirmingPaymentId(t.id);
    try {
      const r = await confirmManualTicketPayment({ ticketId: t.id });
      if (r.ticketsEmailed) {
        alert('✅ Pago registrado. Las entradas fueron enviadas por correo.');
      } else {
        alert('✅ Abono inicial registrado. El comprador recibirá el enlace para completar el saldo.');
      }
      loadTickets();
    } catch (e: unknown) {
      const errMsg =
        e && typeof e === 'object' && 'message' in e
          ? String((e as { message?: string }).message)
          : 'Error al confirmar el pago';
      alert(`❌ ${errMsg}`);
    } finally {
      setConfirmingPaymentId(null);
    }
  };

  const handleReleaseReservedHold = async (t: Ticket) => {
    const loc = ticketLocality(t).displayLine;
    if (
      !window.confirm(
        `¿Poner disponible ${loc}? Se libera la reserva de ${
          ticketListBuyerName(t) || 'este comprador'
        } y el palco/cupo vuelve a la venta.`
      )
    ) {
      return;
    }
    setReleasingHoldId(t.id);
    try {
      const r = await releaseReservedTicket({ ticketId: t.id });
      alert(
        r.alreadyFree
          ? '✅ Ese cupo ya estaba libre.'
          : '✅ Reserva liberada. El palco/cupo ya está disponible para la venta.'
      );
      loadTickets();
    } catch (e: unknown) {
      const errMsg =
        e && typeof e === 'object' && 'message' in e
          ? String((e as { message?: string }).message)
          : 'Error al liberar la reserva';
      alert(`❌ ${errMsg}`);
    } finally {
      setReleasingHoldId(null);
    }
  };

  const formatAbonoPhase = (phase?: string) => {
    const map: Record<string, string> = {
      awaiting_deposit: 'Esperando abono inicial',
      deposit_paid: 'Abono pagado — saldo pendiente',
      awaiting_balance: 'Pago de saldo en curso',
    };
    return map[phase || ''] || 'Abono';
  };

  const abonoPaidCOP = (t: Ticket) => {
    const phase = t.installmentPhase || 'none';
    if (phase === 'awaiting_deposit') return 0;
    return Math.round(Number(t.depositCOP) || 0);
  };

  const abonoPendingCOP = (t: Ticket) => {
    const phase = t.installmentPhase || 'none';
    if (phase === 'awaiting_deposit') return Math.round(Number(t.depositCOP) || Number(t.amount) || 0);
    if (phase === 'deposit_paid' || phase === 'awaiting_balance') {
      return Math.round(Number(t.balanceCOP) || 0);
    }
    return 0;
  };

  const getStatusBadge = (status?: string) => {
    const map: Record<string, { label: string; className: string }> = {
      approved: { label: 'Aprobado', className: 'status-approved' },
      pending: { label: 'Pendiente', className: 'status-pending' },
      reserved: { label: 'Reservado', className: 'status-pending' },
      paid: { label: 'Pagado', className: 'status-approved' },
      cancelled: { label: 'Cancelado', className: 'status-rejected' },
      expired: { label: 'Expirado', className: 'status-rejected' },
      disabled: { label: 'Deshabilitado', className: 'status-rejected' },
      used: { label: 'Usado', className: 'status-unknown' },
      redeemed: { label: 'Validado', className: 'status-approved' },
    };
    const info = map[status || ''] || { label: status || '—', className: 'status-unknown' };
    return <span className={`status-badge ${info.className}`}>{info.label}</span>;
  };

  const getPaymentBadge = (method?: string, createdByAdmin?: string) => {
    if (method === 'manual' || method === 'admin_manual' || createdByAdmin) {
      return <span className="payment-badge payment-manual">Manual</span>;
    }
    if (method?.toLowerCase().includes('mercadopago')) return <span className="payment-badge payment-mercadopago">MercadoPago</span>;
    return <span className="payment-badge payment-other">{method || '—'}</span>;
  };

  if (!eventId) return null;

  const formatRowDate = (ts?: Timestamp | null) => {
    if (!ts) return '—';
    try {
      return ts.toDate().toLocaleString('es-CO', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      return '—';
    }
  };

  const checkoutHoldExpired = (t: Ticket) => {
    const createdMs = t.createdAt?.toMillis?.() ?? 0;
    if (!createdMs) return false;
    return Date.now() - createdMs >= 60 * 60 * 1000;
  };

  const isActiveNonReserved = (t: Ticket) =>
    !isTicketReservedHold(t) && t.ticketStatus !== 'cancelled' && t.ticketStatus !== 'disabled';

  const activeTicketUnits = useMemo(
    () => tickets.filter(isActiveNonReserved).reduce((s, t) => s + ticketDocUnits(t), 0),
    [tickets]
  );
  const cortesiasUnits = useMemo(
    () =>
      tickets
        .filter(isActiveNonReserved)
        .filter((t) => isTicketCourtesyRow(t))
        .reduce((s, t) => s + ticketDocUnits(t), 0),
    [tickets]
  );
  const vendidosUnits = useMemo(() => sumSoldEntradaUnitsForAdminStats(tickets as ServiceTicket[]), [tickets]);
  const validadosUnits = useMemo(
    () =>
      tickets
        .filter((t) => t.validatedAt && !isTicketReservedHold(t))
        .reduce((s, t) => s + ticketDocUnits(t), 0),
    [tickets]
  );
  const reservedDocs = visibleTickets.filter(isTicketCheckoutHold);
  const reservedUnits = reservedDocs.reduce((s, t) => s + ticketDocUnits(t), 0);
  const palcosVendidos = useMemo(() => {
    const sold = new Set<string>();
    tickets.forEach((t) => {
      if (!t.mapZoneId) return;
      if (isTicketReservedHold(t) && !isTicketAbonoRow(t)) return;
      if (t.ticketStatus === 'cancelled' || t.ticketStatus === 'disabled') return;
      if (t.ticketKind === 'purchase_pass') return;
      sold.add(t.mapZoneId);
    });
    return sold.size;
  }, [tickets]);
  const totalPalcos = useMemo(() => {
    const zones = venueMap?.zones || [];
    const palcoZones = zones.filter(
      (z) => z.palco_index != null || zones.filter((x) => x.sectionId === z.sectionId).length > 1
    );
    return new Set(palcoZones.map((z) => z.id)).size;
  }, [venueMap]);
  const exportableClientTickets = useMemo(
    () => ticketsForClientExport(tickets as ServiceTicket[]),
    [tickets]
  );
  const exportableBoleteriaTickets = useMemo(
    () => ticketsForBoleteriaExport(tickets as ServiceTicket[]),
    [tickets]
  );

  const handleExportClientsExcel = () => {
    if (!event?.name || exportableClientTickets.length === 0) return;
    exportEventClientsToExcel(tickets as ServiceTicket[], event.name);
  };

  const handleExportBoleteriaExcel = () => {
    if (!event?.name || exportableBoleteriaTickets.length === 0) return;
    exportEventBoleteriaToExcel(tickets as ServiceTicket[], event.name, venueMap);
  };

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
          <div className="event-tickets-header__actions">
            <SecondaryButton
              type="button"
              onClick={handleExportBoleteriaExcel}
              disabled={exportableBoleteriaTickets.length === 0}
            >
              📥 Descargar boletería Excel
            </SecondaryButton>
            <SecondaryButton
              type="button"
              onClick={handleExportClientsExcel}
              disabled={exportableClientTickets.length === 0}
            >
              📥 Descargar clientes Excel
            </SecondaryButton>
            {canBulkCourtesies && (
              <PrimaryButton onClick={() => setIsBulkUploadOpen(true)}>
                📤 Cargar cortesías Excel
              </PrimaryButton>
            )}
          </div>
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
                <div className="summary-card"><span className="label">Total</span><span className="value">{activeTicketUnits}</span></div>
                <div className="summary-card vendidos"><span className="label">Vendidos</span><span className="value">{vendidosUnits}</span></div>
                <div className="summary-card cortesias"><span className="label">Cortesías</span><span className="value">{cortesiasUnits}</span></div>
                <div className="summary-card"><span className="label">Validados</span><span className="value">{validadosUnits}</span></div>
                {reservedUnits > 0 && (
                  <div className="summary-card reserved">
                    <span className="label">En reserva (sin pago)</span>
                    <span className="value">{reservedUnits}</span>
                    <span className="sublabel">{reservedDocs.length} órdenes</span>
                  </div>
                )}
                {totalPalcos > 0 && (
                  <div className="summary-card palcos">
                    <span className="label">Palcos vendidos</span>
                    <span className="value">{palcosVendidos}</span>
                    <span className="sublabel">de {totalPalcos} configurados</span>
                  </div>
                )}
                {abonoEnabled && (
                  <div className="summary-card abonos">
                    <span className="label">Abonos activos</span>
                    <span className="value">{abonoTicketsFiltered.length}</span>
                    <span className="sublabel">
                      {abonoCompletadosCount > 0
                        ? `${abonoCompletadosCount} completados`
                        : 'con saldo pendiente'}
                    </span>
                  </div>
                )}
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
                {palcosFilterOptions.length > 0 && (
                  <select value={filterPalco} onChange={e => setFilterPalco(e.target.value)} className="filter-select">
                    <option value="">Todos los palcos</option>
                    {palcosFilterOptions.map(p => <option key={p} value={p}>{p}</option>)}
                  </select>
                )}
                <select value={filterValidado} onChange={e => setFilterValidado(e.target.value)} className="filter-select">
                  <option value="all">Todos</option>
                  <option value="validated">✓ Validados</option>
                  <option value="pending">Pendientes</option>
                </select>
                <select value={filterCortesias} onChange={e => setFilterCortesias(e.target.value)} className="filter-select">
                  <option value="all">Todos</option>
                  <option value="only">Solo cortesías</option>
                </select>
                {abonoEnabled && (
                  <select value={filterAbono} onChange={e => setFilterAbono(e.target.value)} className="filter-select">
                    <option value="all">Todos los pagos</option>
                    <option value="pending">Solo abonos pendientes</option>
                    <option value="completed">Solo abonos completados</option>
                    <option value="full">Solo pago total</option>
                  </select>
                )}
              </div>
            </div>

            {filteredTickets.length > 0 && (
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
                        <td>
                          {ticketLocality(ticket).displayLine}
                          {isTicketAbonoCompleted(ticket) && (
                            <span className="badge abono-completed" title="Compra con abono ya completada">Abono ✓</span>
                          )}
                        </td>
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

            {!loading && operativeVisibleTickets.length > 0 && filteredTickets.length === 0 && (
              <div className="event-tickets-empty">
                <p>🔍 No hay boletos confirmados con los filtros aplicados</p>
              </div>
            )}
            {!loading && operativeVisibleTickets.length === 0 && tickets.length > 0 && (
              <div className="event-tickets-empty">
                <p>
                  📭 No hay filas confirmadas en este listado (puede haber solo reservas de cupo). Revisa «Boletas
                  reservadas» abajo.
                </p>
              </div>
            )}

            {visibleTickets.some(isTicketCheckoutHold) && (
              <div className="event-tickets-reserved-panel">
                <div className="event-tickets-reserved-panel__head">
                  <h2 className="event-tickets-reserved-panel__title">Boletas reservadas</h2>
                  <p className="event-tickets-reserved-panel__hint">
                    Checkout a <strong>pago total</strong> sin confirmar. El contador de 10 minutos es solo del
                    formulario; si el cliente ya está en la pasarela, el cupo se mantiene hasta 1 hora para que pueda
                    terminar el pago (PSE/tarjeta). Si abandona, el palco se libera. «Poner disponible» lo suelta antes.
                    Las compras con <strong>abono (p. ej. 30%)</strong> están en «Abonados» y no se sueltan a los 10
                    minutos: el palco queda reservado hasta la fecha límite del saldo.
                  </p>
                </div>
                {reservedTicketsFiltered.length === 0 ? (
                  <p className="event-tickets-reserved-panel__empty">
                    Ninguna reserva coincide con la búsqueda o los filtros seleccionados.
                  </p>
                ) : (
                  <div className="event-tickets-table-container">
                    <table className="event-tickets-table event-tickets-table--reserved">
                      <thead>
                        <tr>
                          <th>Acciones</th>
                          <th>Localidad</th>
                          <th>Cédula</th>
                          <th>Nombre</th>
                          <th>Email</th>
                          <th>Teléfono</th>
                          <th>Cant.</th>
                          <th>Monto</th>
                          <th>Creado</th>
                          <th>Estado</th>
                          <th>Método</th>
                        </tr>
                      </thead>
                      <tbody>
                        {reservedTicketsFiltered.map((ticket) => (
                          <tr key={ticket.id}>
                            <td>
                              {canEditRows && (
                                <div className="event-tickets-reserved-actions">
                                  <button
                                    type="button"
                                    className="btn-confirm-payment"
                                    onClick={() => handleConfirmManualPayment(ticket)}
                                    disabled={
                                      confirmingPaymentId === ticket.id ||
                                      releasingHoldId === ticket.id
                                    }
                                    title="Registrar pago por otro medio"
                                  >
                                    {confirmingPaymentId === ticket.id
                                      ? 'Procesando…'
                                      : 'Recibí el pago por otro medio'}
                                  </button>
                                  <button
                                    type="button"
                                    className="btn-release-hold"
                                    onClick={() => handleReleaseReservedHold(ticket)}
                                    disabled={
                                      confirmingPaymentId === ticket.id ||
                                      releasingHoldId === ticket.id
                                    }
                                    title="Liberar el palco o cupo para que vuelva a la venta"
                                  >
                                    {releasingHoldId === ticket.id
                                      ? 'Liberando…'
                                      : 'Poner disponible'}
                                  </button>
                                </div>
                              )}
                            </td>
                            <td>{ticketLocality(ticket).displayLine}</td>
                            <td>{ticketListBuyerIdNumber(ticket) || '—'}</td>
                            <td>{ticketListBuyerName(ticket) || '—'}</td>
                            <td>{ticket.buyerEmail || '—'}</td>
                            <td>{ticket.buyerPhone || '—'}</td>
                            <td>{Number(ticket.quantity) > 0 ? ticket.quantity : 1}</td>
                            <td>
                              {isTicketCourtesyRow(ticket) ? (
                                <span className="badge cortesia">Cortesía</span>
                              ) : (
                                `$${ticketPerBoletoAmountCOP(ticket, parentBundleMap).toLocaleString('es-CO')}`
                              )}
                            </td>
                            <td>{formatRowDate(ticket.createdAt)}</td>
                            <td>
                              {getStatusBadge(ticket.ticketStatus || ticket.status)}
                              {checkoutHoldExpired(ticket) && (
                                <span className="badge hold-expired" title="Pasó más de 1 hora sin pago; el palco ya no está retenido en la tienda">
                                  Ya expiró
                                </span>
                              )}
                            </td>
                            <td>{getPaymentBadge(ticket.paymentMethod, ticket.createdByAdmin)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}

            {abonoEnabled && (
              <div className="event-tickets-abono-panel">
                <div className="event-tickets-abono-panel__head">
                  <h2 className="event-tickets-abono-panel__title">Abonados</h2>
                  <p className="event-tickets-abono-panel__hint">
                    Compras donde el usuario eligió <strong>pagar con abono</strong> (depósito + saldo).
                    Si ya pagó el 30% (u otro depósito), el palco <strong>sigue reservado</strong> hasta la fecha límite
                    del saldo; no se libera a los 10 minutos.
                  </p>
                </div>
                {abonoTicketsFiltered.length === 0 ? (
                  <p className="event-tickets-abono-panel__empty">
                    No hay abonos activos en este evento.
                    {reservedTicketsFiltered.length > 0 && (
                      <> Las reservas de arriba son checkout a <strong>pago total</strong>, no abonos.</>
                    )}
                    {abonoCompletadosCount > 0 && (
                      <> Hay {abonoCompletadosCount} abono{abonoCompletadosCount === 1 ? '' : 's'} ya completado{abonoCompletadosCount === 1 ? '' : 's'} en el listado principal (badge «Abono ✓»).</>
                    )}
                  </p>
                ) : (
                  <div className="event-tickets-table-container">
                    <table className="event-tickets-table event-tickets-table--abono">
                      <thead>
                        <tr>
                          <th>Acciones</th>
                          <th>Localidad</th>
                          <th>Cédula</th>
                          <th>Nombre</th>
                          <th>Email</th>
                          <th>Estado abono</th>
                          <th>Separó</th>
                          <th>Falta</th>
                          <th>Vence</th>
                          <th>Total compra</th>
                        </tr>
                      </thead>
                      <tbody>
                        {abonoTicketsFiltered.map((ticket) => (
                          <tr key={ticket.id}>
                            <td>
                              {canEditRows && (
                                <button
                                  type="button"
                                  className="btn-confirm-payment"
                                  onClick={() => handleConfirmManualPayment(ticket)}
                                  disabled={confirmingPaymentId === ticket.id}
                                  title="Registrar pago por otro medio"
                                >
                                  {confirmingPaymentId === ticket.id
                                    ? 'Procesando…'
                                    : 'Recibí el pago por otro medio'}
                                </button>
                              )}
                            </td>
                            <td>{ticketLocality(ticket).displayLine}</td>
                            <td>{ticketListBuyerIdNumber(ticket) || '—'}</td>
                            <td>{ticketListBuyerName(ticket) || '—'}</td>
                            <td>{ticket.buyerEmail || '—'}</td>
                            <td>
                              <span className="badge abono">{formatAbonoPhase(ticket.installmentPhase)}</span>
                            </td>
                            <td>${abonoPaidCOP(ticket).toLocaleString('es-CO')}</td>
                            <td className="abono-pending">${abonoPendingCOP(ticket).toLocaleString('es-CO')}</td>
                            <td>{formatRowDate(ticket.balanceDueAt)}</td>
                            <td>
                              ${Math.round(Number(ticket.totalPurchaseCOP) || Number(ticket.amount) || 0).toLocaleString('es-CO')}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
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
              {editingTicket ? ticketLocality(editingTicket).displayLine : 'General'}
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
