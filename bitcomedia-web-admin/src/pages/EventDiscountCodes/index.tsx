import React, { useEffect, useState, useCallback } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  collection,
  doc,
  setDoc,
  deleteDoc,
  onSnapshot,
  serverTimestamp,
  Timestamp,
} from 'firebase/firestore';
import { db } from '@services/firebase';
import TopNavBar from '@containers/TopNavBar';
import EventSubNav from '@components/EventSubNav';
import Loader from '@components/Loader';
import PrimaryButton from '@components/PrimaryButton';
import SecondaryButton from '@components/SecondaryButton';
import CustomInput from '@components/CustomInput';
import {
  getEventOrRecurringById,
  getCurrentUser,
  isSuperAdmin,
  hasAdminAccess,
  getAnyPartnerGrantForTicketEvent,
  resolveEventCollection,
} from '@services';
import type { Event } from '@services/types';
import './index.scss';

type DiscountType = 'percent' | 'fixed_cop';

export type EventDiscountRow = {
  id: string;
  type: DiscountType;
  value: number;
  active: boolean;
  maxRedemptions: number | null;
  redeemedCount: number;
  expiresAt?: Timestamp | null;
};

function normalizeCode(raw: string): string {
  return String(raw || '')
    .trim()
    .toUpperCase()
    .replace(/\s+/g, '');
}

const EventDiscountCodesScreen: React.FC = () => {
  const navigate = useNavigate();
  const { eventId } = useParams<{ eventId: string }>();
  const [event, setEvent] = useState<Event | null>(null);
  const [eventCollection, setEventCollection] = useState<'events' | 'recurring_events' | null>(null);
  const [rows, setRows] = useState<EventDiscountRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showOrganizerExtras, setShowOrganizerExtras] = useState(false);

  const [formCode, setFormCode] = useState('');
  const [formType, setFormType] = useState<DiscountType>('percent');
  const [formValue, setFormValue] = useState('');
  const [formMax, setFormMax] = useState('');
  const [formExpires, setFormExpires] = useState('');
  const [formActive, setFormActive] = useState(true);
  const [saving, setSaving] = useState(false);

  const formatCOP = (n: number) =>
    new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', minimumFractionDigits: 0 }).format(n);

  const loadEventOnly = useCallback(async () => {
    if (!eventId) return;
    try {
      setLoading(true);
      setError(null);
      const [eventData, coll] = await Promise.all([
        getEventOrRecurringById(eventId),
        resolveEventCollection(eventId),
      ]);
      setEvent(eventData || null);
      setEventCollection(coll);
    } catch {
      setError('No se pudo cargar el evento.');
    } finally {
      setLoading(false);
    }
  }, [eventId]);

  useEffect(() => {
    void loadEventOnly();
  }, [loadEventOnly]);

  useEffect(() => {
    if (!eventId || !eventCollection) return;
    const ref = collection(db, eventCollection, eventId, 'discount_codes');
    const unsub = onSnapshot(
      ref,
      (snap) => {
        const list: EventDiscountRow[] = snap.docs.map((d) => {
          const x = d.data() as Record<string, unknown>;
          return {
            id: d.id,
            type: (x.type === 'fixed_cop' ? 'fixed_cop' : 'percent') as DiscountType,
            value: Number(x.value) || 0,
            active: x.active !== false,
            maxRedemptions:
              x.maxRedemptions === undefined || x.maxRedemptions === null ? null : Number(x.maxRedemptions),
            redeemedCount: Math.max(0, Math.round(Number(x.redeemedCount) || 0)),
            expiresAt: (x.expiresAt as Timestamp | undefined) || null,
          };
        });
        list.sort((a, b) => a.id.localeCompare(b.id));
        setRows(list);
      },
      () => setError('Sin permiso para ver cupones o error de red.')
    );
    return () => unsub();
  }, [eventId, eventCollection]);

  useEffect(() => {
    if (loading || !event || !eventId) return;
    const check = async () => {
      const user = getCurrentUser();
      if (!user) return;
      setShowOrganizerExtras(false);
      const superA = await isSuperAdmin(user.uid);
      if (superA) {
        setShowOrganizerExtras(true);
        return;
      }
      if (event.organizer_id === user.uid) {
        setShowOrganizerExtras(true);
        return;
      }
      const admin = await hasAdminAccess(user.uid);
      if (admin) {
        navigate('/dashboard', { replace: true });
        return;
      }
      const pair = await getAnyPartnerGrantForTicketEvent(user.uid, eventId);
      if (pair?.grant.permissions.view_stats) {
        navigate('/dashboard', { replace: true });
        return;
      }
      navigate('/dashboard', { replace: true });
    };
    void check();
  }, [event, eventId, loading, navigate]);

  const resetForm = () => {
    setFormCode('');
    setFormType('percent');
    setFormValue('');
    setFormMax('');
    setFormExpires('');
    setFormActive(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!eventId || !eventCollection) return;
    const id = normalizeCode(formCode);
    if (id.length < 3) {
      setError('El código debe tener al menos 3 caracteres.');
      return;
    }
    const val = Number(formValue);
    if (!Number.isFinite(val) || val <= 0) {
      setError('Indica un valor de descuento válido.');
      return;
    }
    if (formType === 'percent' && val > 100) {
      setError('El porcentaje no puede ser mayor a 100.');
      return;
    }
    let maxRedemptions: number | null = null;
    if (formMax.trim() !== '') {
      const m = Math.floor(Number(formMax));
      if (!Number.isFinite(m) || m < 1) {
        setError('Límite de usos inválido.');
        return;
      }
      maxRedemptions = m;
    }
    let expiresAt: Timestamp | null = null;
    if (formExpires.trim() !== '') {
      const d = new Date(formExpires);
      if (Number.isNaN(d.getTime())) {
        setError('Fecha de vencimiento inválida.');
        return;
      }
      expiresAt = Timestamp.fromDate(d);
    }

    setSaving(true);
    setError(null);
    try {
      const existing = rows.find((r) => r.id === id);
      const ref = doc(db, eventCollection, eventId, 'discount_codes', id);
      await setDoc(
        ref,
        {
          type: formType,
          value: formType === 'percent' ? Math.round(val) : Math.round(val),
          active: formActive,
          maxRedemptions,
          redeemedCount: existing?.redeemedCount ?? 0,
          expiresAt,
          updatedAt: serverTimestamp(),
          ...(existing ? {} : { createdAt: serverTimestamp() }),
        },
        { merge: true }
      );
      resetForm();
    } catch (err) {
      console.error(err);
      setError('No se pudo guardar el cupón. Verifica permisos.');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (codeId: string) => {
    if (!eventId || !eventCollection) return;
    if (!window.confirm(`¿Eliminar el cupón «${codeId}»?`)) return;
    try {
      await deleteDoc(doc(db, eventCollection, eventId, 'discount_codes', codeId));
    } catch {
      setError('No se pudo eliminar el cupón.');
    }
  };

  const handleEdit = (r: EventDiscountRow) => {
    setFormCode(r.id);
    setFormType(r.type);
    setFormValue(String(r.value));
    setFormMax(r.maxRedemptions != null ? String(r.maxRedemptions) : '');
    if (r.expiresAt && typeof r.expiresAt.toDate === 'function') {
      const d = r.expiresAt.toDate();
      const y = d.getFullYear();
      const mo = String(d.getMonth() + 1).padStart(2, '0');
      const da = String(d.getDate()).padStart(2, '0');
      setFormExpires(`${y}-${mo}-${da}`);
    } else {
      setFormExpires('');
    }
    setFormActive(r.active);
  };

  if (loading || !eventId) {
    return (
      <div className="event-discount-codes">
        <TopNavBar />
        <div className="event-discount-codes__loading">
          <Loader size="large" color="accent" />
        </div>
      </div>
    );
  }

  if (!showOrganizerExtras) {
    return (
      <div className="event-discount-codes">
        <TopNavBar />
        <div className="event-discount-codes__denied">
          <p>No tienes permiso para gestionar cupones.</p>
          <SecondaryButton onClick={() => navigate('/dashboard')}>Volver</SecondaryButton>
        </div>
      </div>
    );
  }

  const isRecurring = eventCollection === 'recurring_events';
  const title = event?.name || 'Evento';

  return (
    <div className="event-discount-codes">
      <TopNavBar />
      <div className="event-discount-codes__inner">
        <EventSubNav
          eventId={eventId}
          eventTitle={title}
          isRecurring={isRecurring}
          active="discountCodes"
          showOrganizerExtras
        />

        <section className="event-discount-codes__panel">
          <h1>Códigos de descuento</h1>
          <p className="event-discount-codes__intro">
            El descuento se aplica <strong>solo al valor de las entradas</strong>. La tarifa de servicio (tiquetera) no se
            reduce.
          </p>

          {error ? <p className="event-discount-codes__error">{error}</p> : null}

          <form className="event-discount-codes__form" onSubmit={handleSave}>
            <div className="event-discount-codes__form-grid">
              <CustomInput
                label="Código (visible para el comprador)"
                value={formCode}
                onChange={(e) => setFormCode(e.target.value)}
                placeholder="ej. VERANO25"
              />
              <div className="event-discount-codes__select-wrap">
                <label htmlFor="disc-type">Tipo</label>
                <select
                  id="disc-type"
                  value={formType}
                  onChange={(e) => setFormType(e.target.value === 'fixed_cop' ? 'fixed_cop' : 'percent')}
                >
                  <option value="percent">Porcentaje sobre entradas</option>
                  <option value="fixed_cop">Valor fijo (COP) sobre la línea</option>
                </select>
              </div>
              <CustomInput
                label={formType === 'percent' ? 'Porcentaje (%)' : 'Descuento (COP)'}
                type="number"
                min={1}
                value={formValue}
                onChange={(e) => setFormValue(e.target.value)}
              />
              <CustomInput
                label="Máximo de usos (opcional)"
                type="number"
                min={1}
                value={formMax}
                onChange={(e) => setFormMax(e.target.value)}
                placeholder="ilimitado"
              />
              <CustomInput
                label="Vence (opcional)"
                type="date"
                value={formExpires}
                onChange={(e) => setFormExpires(e.target.value)}
              />
              <label className="event-discount-codes__check">
                <input
                  type="checkbox"
                  checked={formActive}
                  onChange={(e) => setFormActive(e.target.checked)}
                />
                Cupón activo
              </label>
            </div>
            <div className="event-discount-codes__form-actions">
              <PrimaryButton type="submit" disabled={saving}>
                {saving ? 'Guardando…' : 'Guardar cupón'}
              </PrimaryButton>
              <SecondaryButton type="button" onClick={resetForm}>
                Limpiar
              </SecondaryButton>
            </div>
          </form>

          <div className="event-discount-codes__table-wrap">
            <table className="event-discount-codes__table">
              <thead>
                <tr>
                  <th>Código</th>
                  <th>Regla</th>
                  <th>Usos</th>
                  <th>Vence</th>
                  <th>Estado</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {rows.length === 0 ? (
                  <tr>
                    <td colSpan={6}>
                      <span className="event-discount-codes__empty">Aún no hay cupones.</span>
                    </td>
                  </tr>
                ) : (
                  rows.map((r) => (
                    <tr key={r.id}>
                      <td>
                        <code>{r.id}</code>
                      </td>
                      <td>
                        {r.type === 'percent' ? `${r.value}%` : formatCOP(r.value)}
                      </td>
                      <td>
                        {r.maxRedemptions == null
                          ? `${r.redeemedCount} / ∞`
                          : `${r.redeemedCount} / ${r.maxRedemptions}`}
                      </td>
                      <td>
                        {r.expiresAt && typeof r.expiresAt.toDate === 'function'
                          ? r.expiresAt.toDate().toLocaleDateString('es-CO')
                          : '—'}
                      </td>
                      <td>{r.active ? 'Activo' : 'Inactivo'}</td>
                      <td className="event-discount-codes__actions">
                        <button type="button" onClick={() => handleEdit(r)}>
                          Editar
                        </button>
                        <button type="button" className="danger" onClick={() => void handleDelete(r.id)}>
                          Eliminar
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </div>
  );
};

export default EventDiscountCodesScreen;
