import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import TopNavBar from '@containers/TopNavBar';
import PrimaryButton from '@components/PrimaryButton';
import SecondaryButton from '@components/SecondaryButton';
import CustomSelector from '@components/CustomSelector';
import CustomInput from '@components/CustomInput';
import { IconEdit } from '@components/EventCardIcons';
import { IconHubClipboard, IconHubUserPlus } from '@components/ConfigHubIcons';
import {
  logoutUser,
  getCurrentUser,
  isSuperAdmin,
  getEventOrRecurringById,
  getPartnerCandidateUsers,
  listAllPartnerGrants,
  upsertPartnerGrant,
  deletePartnerGrant,
  DEFAULT_PARTNER_PERMISSIONS,
  createPartnerUserAccount,
  getUserData,
  appendAuditLog,
} from '@services';
import type { PartnerEventGrant, PartnerEventPermissions, UserData } from '@services';
import { collection, getDocs, query } from 'firebase/firestore';
import { db } from '@services/firebase';
import './index.scss';

type EventOption = {
  id: string;
  name: string;
  isRecurring: boolean;
};

const PERM_LABELS: { key: keyof PartnerEventPermissions; label: string; hint: string }[] = [
  { key: 'read_tickets', label: 'Ver listado de boletos', hint: 'Consultar boletos del evento (solo lectura).' },
  { key: 'create_tickets', label: 'Crear boletos manuales / cortesías', hint: 'Modal “Crear” y función en cloud.' },
  {
    key: 'taquilla_sale',
    label: 'Venta en taquilla (precio público)',
    hint: 'Solo venta presencial a precio de lista; sin cortesías (módulo /taquilla).',
  },
  { key: 'edit_event', label: 'Editar evento', hint: 'Acceso al formulario del evento o recurrente.' },
  { key: 'view_stats', label: 'Ver estadísticas', hint: 'Pantalla de stats y gastos del evento.' },
  { key: 'scan_validate', label: 'Escanear y validar en taquilla', hint: 'Leer Boletos / validar entradas.' },
];

function firebaseErrorMessage(err: unknown): string {
  const code = (err as { code?: string })?.code;
  if (code === 'auth/email-already-in-use') {
    return 'Ese correo ya está registrado. Usa “Usuario existente” o elige otro correo.';
  }
  if (code === 'auth/invalid-email') return 'El correo no es válido.';
  if (code === 'auth/weak-password') return 'La contraseña es demasiado débil.';
  return err instanceof Error ? err.message : 'Ocurrió un error. Intenta de nuevo.';
}

const SuperAdminPartnersScreen: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const nuevoParam = searchParams.get('nuevo');
  const createFlowExisting = nuevoParam === 'existente';
  const createFlowNewUser = nuevoParam === 'nuevo';

  const [loading, setLoading] = useState(true);
  const [superOk, setSuperOk] = useState(false);
  const [candidates, setCandidates] = useState<UserData[]>([]);
  const [grants, setGrants] = useState<PartnerEventGrant[]>([]);
  const [eventOptions, setEventOptions] = useState<EventOption[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const [selectedUid, setSelectedUid] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [newName, setNewName] = useState('');
  const [newPhone, setNewPhone] = useState('');

  const [eventPick, setEventPick] = useState('');
  const [perms, setPerms] = useState<PartnerEventPermissions>({ ...DEFAULT_PARTNER_PERMISSIONS });
  const [editingGrant, setEditingGrant] = useState<PartnerEventGrant | null>(null);
  const [grantFilterEvent, setGrantFilterEvent] = useState('');

  const showNewAccessForm = !editingGrant && (createFlowExisting || createFlowNewUser);
  const showNewAccessHub = !editingGrant && !showNewAccessForm;

  useEffect(() => {
    const run = async () => {
      const u = getCurrentUser();
      if (!u) {
        navigate('/login');
        return;
      }
      const ok = await isSuperAdmin(u.uid);
      if (!ok) {
        navigate('/dashboard');
        return;
      }
      setSuperOk(true);
      try {
        const [cand, allGrants] = await Promise.all([getPartnerCandidateUsers(), listAllPartnerGrants()]);
        setCandidates(cand);
        setGrants(allGrants);

        const [evSnap, recSnap] = await Promise.all([
          getDocs(query(collection(db, 'events'))),
          getDocs(query(collection(db, 'recurring_events'))),
        ]);
        const opts: EventOption[] = [];
        evSnap.forEach((d) => {
          const n = (d.data().name as string) || d.id;
          opts.push({ id: d.id, name: `${n} (evento)`, isRecurring: false });
        });
        recSnap.forEach((d) => {
          const n = (d.data().name as string) || d.id;
          opts.push({ id: d.id, name: `${n} (recurrente)`, isRecurring: true });
        });
        opts.sort((a, b) => a.name.localeCompare(b.name, 'es'));
        setEventOptions(opts);
      } catch (e) {
        console.error(e);
        setError('No se pudieron cargar los datos.');
      } finally {
        setLoading(false);
      }
    };
    void run();
  }, [navigate]);

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

  const eventSelectOptions = useMemo(
    () => eventOptions.map((o) => ({ value: `${o.isRecurring ? '1' : '0'}:${o.id}`, label: o.name })),
    [eventOptions]
  );

  const eventLabelByGrant = useMemo(() => {
    const m = new Map<string, string>();
    eventOptions.forEach((o) => {
      m.set(`${o.isRecurring ? '1' : '0'}:${o.id}`, o.name);
    });
    return m;
  }, [eventOptions]);

  const filteredGrants = useMemo(() => {
    if (!grantFilterEvent) return grants;
    return grants.filter((g) => {
      const key = `${g.event_path === 'recurring_events' ? '1' : '0'}:${g.event_id}`;
      return key === grantFilterEvent;
    });
  }, [grants, grantFilterEvent]);

  const refreshGrantsAndCandidates = async () => {
    const [allGrants, cand] = await Promise.all([listAllPartnerGrants(), getPartnerCandidateUsers()]);
    setGrants(allGrants);
    setCandidates(cand);
  };

  const parseEventPick = (v: string): { id: string; isRecurring: boolean } | null => {
    const m = v.match(/^([01]):(.+)$/);
    if (!m) return null;
    return { isRecurring: m[1] === '1', id: m[2] };
  };

  const resetNewUserFields = () => {
    setNewEmail('');
    setNewPassword('');
    setNewName('');
    setNewPhone('');
  };

  const resetFieldsForNewAccess = () => {
    resetNewUserFields();
    setSelectedUid('');
    setEventPick('');
    setPerms({ ...DEFAULT_PARTNER_PERMISSIONS });
  };

  const backToCreateHub = () => {
    setSearchParams({});
    resetFieldsForNewAccess();
  };

  const handleSave = async () => {
    setError(null);
    const ev = parseEventPick(eventPick);
    if (!ev) {
      setError('Selecciona un evento.');
      return;
    }

    let targetUid = '';
    let targetEmail = '';

    if (editingGrant) {
      targetUid = editingGrant.user_id;
      targetEmail = editingGrant.partner_email?.trim() || '';
      if (!targetEmail) {
        const ud = await getUserData(targetUid);
        targetEmail = ud?.email?.trim() || '';
      }
      if (!targetEmail) {
        setError('No se pudo determinar el correo del usuario.');
        return;
      }
    } else if (createFlowNewUser) {
      if (!newEmail.trim() || !newPassword || !newName.trim()) {
        setError('Completa correo, contraseña y nombre para el nuevo usuario.');
        return;
      }
    } else if (createFlowExisting) {
      if (!selectedUid.trim()) {
        setError('Selecciona un usuario.');
        return;
      }
      targetUid = selectedUid.trim();
      const userRow = candidates.find((c) => c.uid === targetUid);
      targetEmail = userRow?.email?.trim() || '';
      if (!targetEmail) {
        const ud = await getUserData(targetUid);
        targetEmail = ud?.email?.trim() || '';
      }
      if (!targetEmail) {
        setError('No se encontró correo para el usuario seleccionado.');
        return;
      }
    } else {
      setError('Elige primero una opción en “Nuevo acceso por evento”.');
      return;
    }

    setSaving(true);
    try {
      if (!editingGrant && createFlowNewUser) {
        const created = await createPartnerUserAccount({
          email: newEmail.trim(),
          password: newPassword,
          name: newName.trim(),
          phone: newPhone.trim(),
        });
        targetUid = created.uid;
        targetEmail = created.email;
      }

      const exists = await getEventOrRecurringById(ev.id);
      if (!exists) {
        setError('No se encontró el evento en Firestore.');
        return;
      }

      await upsertPartnerGrant({
        targetUid,
        targetEmail,
        eventId: ev.id,
        isRecurring: ev.isRecurring,
        permissions: { ...perms },
      });
      void appendAuditLog({
        kind: 'partner_grant_upsert',
        entityType: ev.isRecurring ? 'recurring_events' : 'events',
        entityId: ev.id,
        summary: `Partner ${targetEmail || targetUid.slice(0, 8)} en «${exists.name || ev.id}»: ${Object.entries(perms)
          .filter(([, v]) => v)
          .map(([k]) => k)
          .join(', ') || 'sin permisos'}`,
      }).catch(() => undefined);

      setEditingGrant(null);
      setSearchParams({});
      resetFieldsForNewAccess();
      await refreshGrantsAndCandidates();
    } catch (e) {
      console.error(e);
      setError(firebaseErrorMessage(e));
    } finally {
      setSaving(false);
    }
  };

  const startEdit = (g: PartnerEventGrant) => {
    setSearchParams({});
    setEditingGrant(g);
    setSelectedUid(g.user_id);
    const flag = g.event_path === 'recurring_events' ? '1' : '0';
    setEventPick(`${flag}:${g.event_id}`);
    setPerms({ ...DEFAULT_PARTNER_PERMISSIONS, ...g.permissions });
    resetNewUserFields();
  };

  const cancelEdit = () => {
    setEditingGrant(null);
    setSelectedUid('');
    setEventPick('');
    setPerms({ ...DEFAULT_PARTNER_PERMISSIONS });
    resetNewUserFields();
  };

  const handleDelete = async (g: PartnerEventGrant) => {
    if (!window.confirm(g.partner_email ? `¿Quitar acceso de ${g.partner_email} a este evento?` : '¿Eliminar este acceso partner?')) return;
    setSaving(true);
    try {
      await deletePartnerGrant(g.user_id, g.event_id, g.event_path === 'recurring_events');
      void appendAuditLog({
        kind: 'partner_grant_delete',
        entityType: g.event_path,
        entityId: g.event_id,
        summary: `Partner ${g.partner_email || g.user_id.slice(0, 8)} quitado del evento`,
      }).catch(() => undefined);
      if (editingGrant?.id === g.id) cancelEdit();
      await refreshGrantsAndCandidates();
    } catch (e) {
      console.error(e);
      setError('No se pudo eliminar.');
    } finally {
      setSaving(false);
    }
  };

  const handleLogout = async () => {
    await logoutUser();
  };

  if (loading) {
    return (
      <div className="super-admin-partners">
        <p>Cargando…</p>
      </div>
    );
  }

  if (!superOk) return null;

  return (
    <div className="super-admin-partners">
      <TopNavBar
        logoOnly
        showLogout
        onLogout={handleLogout}
        adminNavOptions={{ showConfig: true, showScan: true, showTaquilla: true }}
      />

      <div className="super-admin-partners__inner">
        <header className="super-admin-partners__hero">
          <div className="super-admin-partners__hero-text">
            <p className="super-admin-partners__eyebrow">Control de plataforma</p>
            <h1 className="super-admin-partners__title">Usuarios partner</h1>
            <p className="super-admin-partners__lede">
              Crea cuentas nuevas o enlaza usuarios existentes a un evento. Los permisos se pueden ajustar después con Editar.
            </p>
          </div>
          <div className="super-admin-partners__hero-actions">
            <SecondaryButton size="small" onClick={() => navigate('/config')}>
              ← Volver al centro de configuración
            </SecondaryButton>
          </div>
        </header>

        {error && <div className="super-admin-partners__error">{error}</div>}

        <section className="card-block" aria-labelledby="partner-list-title">
          <h2 id="partner-list-title">
            <span className="super-admin-partners__section-icon" aria-hidden>
              <IconHubClipboard size={17} />
            </span>
            Accesos configurados ({filteredGrants.length}
            {grantFilterEvent ? ` de ${grants.length}` : ''})
          </h2>
          {grants.length === 0 ? (
            <p className="super-admin-partners__muted">Aún no hay permisos partner.</p>
          ) : (
            <>
              <label className="super-admin-partners__label super-admin-partners__filter">
                <span className="super-admin-partners__filter-label">Filtrar por evento</span>
                <CustomSelector
                  value={grantFilterEvent}
                  options={[{ value: '', label: 'Todos los eventos' }, ...eventSelectOptions]}
                  onChange={(e) => setGrantFilterEvent(String(e.target.value))}
                />
              </label>
              {filteredGrants.length === 0 ? (
                <p className="super-admin-partners__muted">Ningún acceso coincide con este evento. Prueba otro filtro.</p>
              ) : (
                <div className="super-admin-partners__table-wrap">
                  <table className="super-admin-partners__table">
                    <thead>
                      <tr>
                        <th>Correo</th>
                        <th>Evento</th>
                        <th>Tipo</th>
                        <th>Permisos</th>
                        <th />
                      </tr>
                    </thead>
                    <tbody>
                      {filteredGrants.map((g) => {
                        const evKey = `${g.event_path === 'recurring_events' ? '1' : '0'}:${g.event_id}`;
                        const evLabel = eventLabelByGrant.get(evKey) || g.event_id;
                        return (
                          <tr key={g.id}>
                            <td>{g.partner_email || g.user_id}</td>
                            <td title={g.event_id}>{evLabel}</td>
                            <td>{g.event_path === 'recurring_events' ? 'Recurrente' : 'Evento'}</td>
                            <td className="super-admin-partners__perm-cell">
                              {PERM_LABELS.filter((p) => g.permissions[p.key])
                                .map((p) => p.label)
                                .join(' · ') || '—'}
                            </td>
                            <td>
                              <button type="button" className="linkish" onClick={() => startEdit(g)}>
                                Editar
                              </button>{' '}
                              <button type="button" className="linkish danger" onClick={() => void handleDelete(g)}>
                                Quitar
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </>
          )}
        </section>

        <section className="super-admin-partners__form card-block" aria-labelledby="partner-form-title">
          <h2 id="partner-form-title">
            <span className="super-admin-partners__section-icon" aria-hidden>
              {editingGrant ? <IconEdit size={17} /> : <IconHubUserPlus size={17} />}
            </span>
            {editingGrant ? 'Editar acceso' : 'Nuevo acceso por evento'}
          </h2>

          {showNewAccessHub && (
            <>
              <p className="super-admin-partners__hub-lede">Elige cómo quieres añadir un permiso; cada opción abre su propio formulario.</p>
              <div className="super-admin-partners__hub">
                <button
                  type="button"
                  className="super-admin-partners__hub-card"
                  onClick={() => {
                    resetFieldsForNewAccess();
                    setSearchParams({ nuevo: 'existente' });
                  }}
                >
                  <span className="super-admin-partners__hub-card-title">Usuario ya registrado</span>
                  <span className="super-admin-partners__hub-card-desc">
                    Enlaza una cuenta que ya existe en la plataforma a un evento y define permisos.
                  </span>
                </button>
                <button
                  type="button"
                  className="super-admin-partners__hub-card"
                  onClick={() => {
                    resetFieldsForNewAccess();
                    setSearchParams({ nuevo: 'nuevo' });
                  }}
                >
                  <span className="super-admin-partners__hub-card-title">Crear nuevo usuario</span>
                  <span className="super-admin-partners__hub-card-desc">
                    Genera una cuenta nueva; al guardar quedará vinculada al evento que elijas.
                  </span>
                </button>
              </div>
            </>
          )}

          {(showNewAccessForm || editingGrant) && (
            <>
              {showNewAccessForm && (
                <div className="super-admin-partners__form-back">
                  <SecondaryButton type="button" size="small" onClick={backToCreateHub} disabled={saving}>
                    ← Volver a opciones
                  </SecondaryButton>
                </div>
              )}

              <div className="super-admin-partners__fields">
                {editingGrant && (
                  <p className="super-admin-partners__edit-hint">
                    <strong>{editingGrant.partner_email || editingGrant.user_id}</strong> — puedes cambiar permisos y guardar.
                    Para otro evento, quita este acceso y crea uno nuevo.
                  </p>
                )}

                {createFlowExisting && (
                  <label className="super-admin-partners__label">
                    Usuario
                    <CustomSelector
                      value={selectedUid}
                      options={[{ value: '', label: '— Elegir —' }, ...userOptions]}
                      onChange={(e) => setSelectedUid(String(e.target.value))}
                    />
                  </label>
                )}

                {createFlowNewUser && (
                  <>
                    <CustomInput
                      label="Correo electrónico"
                      type="email"
                      value={newEmail}
                      onChange={(e) => setNewEmail(e.target.value)}
                      placeholder="partner@empresa.com"
                      autoComplete="off"
                    />
                    <CustomInput
                      label="Contraseña temporal"
                      type="password"
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      placeholder="Mínimo 6 caracteres"
                      autoComplete="new-password"
                    />
                    <CustomInput
                      label="Nombre completo"
                      value={newName}
                      onChange={(e) => setNewName(e.target.value)}
                      placeholder="Nombre visible en el panel"
                    />
                    <CustomInput
                      label="Teléfono (opcional)"
                      type="tel"
                      value={newPhone}
                      onChange={(e) => setNewPhone(e.target.value)}
                      placeholder=""
                    />
                    <p className="super-admin-partners__hint-new">
                      Se crea la cuenta en Firebase vinculada al evento al guardar; el rol pasa a partner y puede entrar con este correo y contraseña. Puedes usar “Olvidé mi contraseña” en el login si más adelante solo quieres correo.
                    </p>
                  </>
                )}

                <label className="super-admin-partners__label">
                  Evento
                  <CustomSelector
                    value={eventPick}
                    options={[{ value: '', label: '— Elegir —' }, ...eventSelectOptions]}
                    onChange={(e) => setEventPick(String(e.target.value))}
                    disabled={!!editingGrant}
                  />
                </label>
              </div>

              <fieldset className="super-admin-partners__perms">
                <legend>Permisos</legend>
                <ul>
                  {PERM_LABELS.map(({ key, label, hint }) => (
                    <li key={key}>
                      <label className="super-admin-partners__toggle">
                        <input
                          type="checkbox"
                          checked={perms[key]}
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
              </fieldset>

              <div className="super-admin-partners__actions">
                <PrimaryButton type="button" onClick={() => void handleSave()} disabled={saving}>
                  {saving ? 'Guardando…' : editingGrant ? 'Actualizar permisos' : 'Crear acceso'}
                </PrimaryButton>
                {editingGrant && (
                  <SecondaryButton type="button" onClick={cancelEdit} disabled={saving}>
                    Cancelar edición
                  </SecondaryButton>
                )}
              </div>
            </>
          )}
        </section>
      </div>
    </div>
  );
};

export default SuperAdminPartnersScreen;
