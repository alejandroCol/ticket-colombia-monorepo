import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { httpsCallable } from 'firebase/functions';
import TopNavBar from '@containers/TopNavBar';
import PrimaryButton from '@components/PrimaryButton';
import SecondaryButton from '@components/SecondaryButton';
import CustomSelector from '@components/CustomSelector';
import EventSubNav from '@components/EventSubNav';
import { PROMOTER_PERM_LABELS } from '../../config/promoterPermissionLabels';
import {
  getCurrentUser,
  getEventOrRecurringById,
  getPartnerCandidateUsers,
  isSuperAdmin,
  listPartnerGrantsForEvent,
  logoutUser,
  resolveEventCollection,
  DEFAULT_PARTNER_PERMISSIONS,
  functions,
} from '@services';
import type { PartnerEventGrant, PartnerEventPermissions, UserData } from '@services';
import './index.scss';

const EventPromotersScreen: React.FC = () => {
  const { eventId } = useParams<{ eventId: string }>();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [eventTitle, setEventTitle] = useState('');
  const [isRecurring, setIsRecurring] = useState(false);
  const [accessDenied, setAccessDenied] = useState(false);
  const [grants, setGrants] = useState<PartnerEventGrant[]>([]);
  const [candidates, setCandidates] = useState<UserData[]>([]);
  const [selectedUid, setSelectedUid] = useState('');
  const [perms, setPerms] = useState<PartnerEventPermissions>({ ...DEFAULT_PARTNER_PERMISSIONS });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showOrganizerExtras, setShowOrganizerExtras] = useState(false);

  const load = useCallback(async () => {
    if (!eventId) return;
    setLoading(true);
    setError(null);
    setAccessDenied(false);
    try {
      const user = getCurrentUser();
      if (!user) {
        navigate('/login');
        return;
      }
      const [ev, coll, superA] = await Promise.all([
        getEventOrRecurringById(eventId),
        resolveEventCollection(eventId),
        isSuperAdmin(user.uid),
      ]);
      if (!ev || !coll) {
        setAccessDenied(true);
        return;
      }
      const recurring = coll === 'recurring_events';
      setIsRecurring(recurring);
      setEventTitle(ev.name || 'Evento');
      const org = String(ev.organizer_id || '').trim();
      const canManage = superA || org === user.uid;
      setShowOrganizerExtras(canManage);
      if (!canManage) {
        setAccessDenied(true);
        return;
      }
      const [g, cand] = await Promise.all([
        listPartnerGrantsForEvent(eventId, recurring),
        getPartnerCandidateUsers(),
      ]);
      setGrants(g);
      setCandidates(cand);
    } catch (e) {
      console.error(e);
      setError('No se pudieron cargar los promotores.');
    } finally {
      setLoading(false);
    }
  }, [eventId, navigate]);

  useEffect(() => {
    void load();
  }, [load]);

  const userOptions = useMemo(
    () =>
      candidates
        .filter((c) => c.role !== 'SUPER_ADMIN' && c.role !== 'ADMIN' && c.role !== 'admin')
        .map((c) => ({
          value: c.uid,
          label: `${c.email || c.uid}${c.name ? ` · ${c.name}` : ''}`,
        })),
    [candidates]
  );

  const selectedUser = useMemo(
    () => candidates.find((c) => c.uid === selectedUid),
    [candidates, selectedUid]
  );

  const manageGrant = httpsCallable(functions, 'manageEventPromoterGrant');

  const handleAddOrUpdate = async () => {
    if (!eventId || !selectedUid) {
      setError('Selecciona un usuario.');
      return;
    }
    const email = (selectedUser?.email || '').trim();
    if (!email) {
      setError('El usuario no tiene correo en el perfil.');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await manageGrant({
        action: 'upsert',
        targetUid: selectedUid,
        targetEmail: email,
        eventId,
        isRecurring,
        permissions: { ...perms },
      });
      setSelectedUid('');
      setPerms({ ...DEFAULT_PARTNER_PERMISSIONS });
      await load();
    } catch (e: unknown) {
      const msg = (e as { message?: string })?.message || 'No se pudo guardar.';
      setError(msg);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (g: PartnerEventGrant) => {
    if (!eventId) return;
    if (!confirm(`¿Quitar a ${g.partner_email || g.user_id} como promotor de este evento?`)) return;
    setSaving(true);
    setError(null);
    try {
      await manageGrant({
        action: 'delete',
        targetUid: g.user_id,
        targetEmail: g.partner_email || '',
        eventId,
        isRecurring,
      });
      await load();
    } catch (e: unknown) {
      const msg = (e as { message?: string })?.message || 'No se pudo eliminar.';
      setError(msg);
    } finally {
      setSaving(false);
    }
  };

  const startEdit = (g: PartnerEventGrant) => {
    setSelectedUid(g.user_id);
    setPerms({ ...DEFAULT_PARTNER_PERMISSIONS, ...g.permissions });
  };

  if (!eventId) return null;

  if (loading) {
    return (
      <div className="event-promoters-screen">
        <TopNavBar logoOnly showLogout onLogout={() => logoutUser()} />
        <p className="event-promoters-muted">Cargando…</p>
      </div>
    );
  }

  if (accessDenied) {
    return (
      <div className="event-promoters-screen">
        <TopNavBar logoOnly showLogout onLogout={() => logoutUser()} />
        <div className="event-promoters-panel">
          <p>No tienes permiso para gestionar promotores de este evento.</p>
          <SecondaryButton onClick={() => navigate('/dashboard')}>Volver al inicio</SecondaryButton>
        </div>
      </div>
    );
  }

  return (
    <div className="event-promoters-screen">
      <TopNavBar logoOnly showLogout onLogout={() => logoutUser()} />
      <EventSubNav
        eventId={eventId}
        eventTitle={eventTitle}
        isRecurring={isRecurring}
        active="promoters"
        showOrganizerExtras={showOrganizerExtras}
      />
      <div className="event-promoters-content">
        <section className="event-promoters-panel">
          <h2 className="event-promoters-h2">Invitar o actualizar promotor</h2>
          <p className="event-promoters-lead">
            Los promotores acceden al panel con el rol “partner” y solo ven lo que marques abajo (igual que en accesos
            globales del super admin).
          </p>
          {error && <div className="event-promoters-error" role="alert">{error}</div>}
          <div className="event-promoters-form-grid">
            <CustomSelector
              name="promoter_user"
              label="Usuario"
              value={selectedUid}
              onChange={(e) => setSelectedUid(String(e.target.value))}
              options={[{ value: '', label: '— Elige cuenta —' }, ...userOptions]}
            />
            <div className="event-promoters-perms">
              <span className="event-promoters-perms-label">Permisos en este evento</span>
              <ul className="event-promoters-perm-list">
                {PROMOTER_PERM_LABELS.map(({ key, label, hint }) => (
                  <li key={key}>
                    <label className="event-promoters-checkbox">
                      <input
                        type="checkbox"
                        checked={!!perms[key]}
                        onChange={(e) => setPerms((p) => ({ ...p, [key]: e.target.checked }))}
                      />
                      <span>
                        <strong>{label}</strong>
                        <small>{hint}</small>
                      </span>
                    </label>
                  </li>
                ))}
              </ul>
            </div>
          </div>
          <div className="event-promoters-actions">
            <PrimaryButton onClick={() => void handleAddOrUpdate()} loading={saving} disabled={saving}>
              Guardar promoción
            </PrimaryButton>
            <SecondaryButton
              type="button"
              onClick={() => {
                setSelectedUid('');
                setPerms({ ...DEFAULT_PARTNER_PERMISSIONS });
              }}
              disabled={saving}
            >
              Limpiar
            </SecondaryButton>
          </div>
        </section>

        <section className="event-promoters-panel">
          <h2 className="event-promoters-h2">Promotores actuales ({grants.length})</h2>
          {grants.length === 0 ? (
            <p className="event-promoters-muted">Aún no hay promotores asignados a este evento.</p>
          ) : (
            <ul className="event-promoters-list">
              {grants.map((g) => (
                <li key={g.id} className="event-promoters-row">
                  <div className="event-promoters-row-main">
                    <strong>{g.partner_email || g.user_id}</strong>
                    <span className="event-promoters-row-meta">{g.user_id}</span>
                  </div>
                  <div className="event-promoters-row-tags">
                    {PROMOTER_PERM_LABELS.filter((x) => g.permissions[x.key]).map((x) => (
                      <span key={x.key} className="event-promoters-tag">{x.label}</span>
                    ))}
                  </div>
                  <div className="event-promoters-row-btns">
                    <SecondaryButton type="button" size="small" onClick={() => startEdit(g)} disabled={saving}>
                      Editar permisos
                    </SecondaryButton>
                    <SecondaryButton type="button" size="small" onClick={() => void handleDelete(g)} disabled={saving}>
                      Quitar
                    </SecondaryButton>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
};

export default EventPromotersScreen;
