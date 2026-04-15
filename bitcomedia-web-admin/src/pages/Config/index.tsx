import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import TopNavBar from '@containers/TopNavBar';
import PrimaryButton from '@components/PrimaryButton';
import SecondaryButton from '@components/SecondaryButton';
import CustomInput from '@components/CustomInput';
import CustomSelector from '@components/CustomSelector';
import {
  getContactConfig,
  updateContactConfig,
  getPaymentConfig,
  updatePaymentProviderConfig,
  logoutUser,
  getCurrentUser,
  isSuperAdmin,
  getAdminUsersList,
  updateUserDocument,
  getOrganizerBuyerFee,
  setOrganizerBuyerFee,
  getOrganizerMpSellerConfigured,
  setOrganizerMpSellerAccessToken,
  clearOrganizerMpSellerAccessToken,
  fetchOrganizerEventsIndex,
  setEventOrganizerId,
  appendAuditLog,
} from '@services';
import type { Event } from '@services/types';
import type { OrganizerEventsIndex } from '@services';
import { IconStats } from '@components/EventCardIcons';
import {
  IconHubContact,
  IconHubBolt,
  IconHubImage,
  IconHubWallet,
  IconHubSpark,
  IconHubHandshake,
  IconHubUsers,
  IconHubChevronRight,
} from '@components/ConfigHubIcons';
import { getOnePayWebhookUrl } from '../../config/cloudFunctionsPublic';
import './index.scss';

type TransferTarget = {
  coll: 'events' | 'recurring_events';
  id: string;
  name: string;
  fromUid: string;
};

function eventRowMeta(e: Event): string {
  const parts = [e.date, e.city].filter(Boolean);
  return parts.length ? parts.join(' · ') : '—';
}

const ConfigScreen: React.FC = () => {
  const navigate = useNavigate();
  const [whatsappPhone, setWhatsappPhone] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [superAdmin, setSuperAdmin] = useState(false);
  const [admins, setAdmins] = useState<Awaited<ReturnType<typeof getAdminUsersList>>>([]);
  const [adminsLoading, setAdminsLoading] = useState(false);
  const [adminActionId, setAdminActionId] = useState<string | null>(null);
  const [adminFeeSaving, setAdminFeeSaving] = useState<string | null>(null);
  const [adminFeeForms, setAdminFeeForms] = useState<
    Record<string, { fee_type: string; fee_value: string }>
  >({});
  const [organizerEventsIndex, setOrganizerEventsIndex] = useState<OrganizerEventsIndex | null>(null);
  const [organizerEventsLoading, setOrganizerEventsLoading] = useState(false);
  const [transferOpen, setTransferOpen] = useState<TransferTarget | null>(null);
  const [transferPickUid, setTransferPickUid] = useState('');
  const [transferSaving, setTransferSaving] = useState(false);
  const [mpSellerConfigured, setMpSellerConfigured] = useState<Record<string, boolean>>({});
  const [mpSellerTokenInput, setMpSellerTokenInput] = useState<Record<string, string>>({});
  const [mpSellerSaving, setMpSellerSaving] = useState<string | null>(null);
  const [paymentProvider, setPaymentProvider] = useState<'mercadopago' | 'onepay'>('mercadopago');
  const [paymentProviderSaving, setPaymentProviderSaving] = useState(false);

  const adminSelectOptions = useMemo(
    () =>
      admins.map((x) => ({
        value: x.uid,
        label: `${x.name || x.email || x.uid}${x.active === false ? ' (inactivo)' : ''} · ${x.email}`,
      })),
    [admins]
  );

  useEffect(() => {
    const load = async () => {
      try {
        const config = await getContactConfig();
        setWhatsappPhone(config.whatsappPhone);
      } catch (e) {
        setError('No se pudo cargar la configuración.');
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  useEffect(() => {
    const run = async () => {
      const u = getCurrentUser();
      if (!u) return;
      const ok = await isSuperAdmin(u.uid);
      setSuperAdmin(ok);
      if (!ok) return;
      setAdminsLoading(true);
      try {
        setAdmins(await getAdminUsersList());
      } catch {
        setAdmins([]);
      } finally {
        setAdminsLoading(false);
      }
    };
    void run();
  }, []);

  useEffect(() => {
    if (!superAdmin || admins.length === 0) return;
    const run = async () => {
      const pairs = await Promise.all(
        admins.map(async (a) => [a.uid, await getOrganizerMpSellerConfigured(a.uid)] as const)
      );
      setMpSellerConfigured(Object.fromEntries(pairs));
    };
    void run();
  }, [superAdmin, admins]);

  useEffect(() => {
    if (!superAdmin || admins.length === 0) return;
    let cancelled = false;
    void (async () => {
      const entries = await Promise.all(
        admins.map(async (a) => {
          const f = await getOrganizerBuyerFee(a.uid);
          return [
            a.uid,
            {
              fee_type: f?.fee_type ?? 'none',
              fee_value: f != null ? String(f.fee_value) : '',
            },
          ] as const;
        })
      );
      if (!cancelled) {
        setAdminFeeForms(Object.fromEntries(entries));
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [superAdmin, admins]);

  useEffect(() => {
    if (!superAdmin) return;
    let cancelled = false;
    setOrganizerEventsLoading(true);
    void (async () => {
      try {
        const idx = await fetchOrganizerEventsIndex();
        if (!cancelled) setOrganizerEventsIndex(idx);
      } catch {
        if (!cancelled) setOrganizerEventsIndex(null);
      } finally {
        if (!cancelled) setOrganizerEventsLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [superAdmin]);

  useEffect(() => {
    if (!superAdmin) return;
    let cancelled = false;
    void (async () => {
      try {
        const c = await getPaymentConfig();
        if (!cancelled && c) {
          setPaymentProvider(c.payment_provider);
        }
      } catch {
        // keep default provider
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [superAdmin]);

  const openTransfer = (coll: 'events' | 'recurring_events', ev: Event, fromUid: string) => {
    setTransferOpen({ coll, id: ev.id, name: ev.name, fromUid });
    const preferActive = admins.find((x) => x.uid !== fromUid && x.active !== false);
    const anyOther = admins.find((x) => x.uid !== fromUid);
    setTransferPickUid((preferActive || anyOther)?.uid || '');
  };

  const handleApplyTransfer = async () => {
    if (!transferOpen) return;
    const pick = transferPickUid.trim();
    if (!pick) {
      alert('Elige un administrador.');
      return;
    }
    if (pick === transferOpen.fromUid) {
      alert('Selecciona otro administrador distinto al actual.');
      return;
    }
    const targetAdmin = admins.find((x) => x.uid === pick);
    if (
      !confirm(
        `¿Asignar el evento «${transferOpen.name}» a ${targetAdmin?.name || targetAdmin?.email || pick}?`
      )
    ) {
      return;
    }
    setTransferSaving(true);
    try {
      await setEventOrganizerId(transferOpen.coll, transferOpen.id, pick);
      void appendAuditLog({
        kind: 'event_organizer_transfer',
        entityType: transferOpen.coll,
        entityId: transferOpen.id,
        summary: `Evento «${transferOpen.name}» reasignado ${transferOpen.fromUid.slice(0, 8)}… → ${pick.slice(0, 8)}…`,
      }).catch(() => undefined);
      setOrganizerEventsIndex(await fetchOrganizerEventsIndex());
      setTransferOpen(null);
      setTransferPickUid('');
    } catch (err) {
      alert(err instanceof Error ? err.message : 'No se pudo reasignar el evento.');
    } finally {
      setTransferSaving(false);
    }
  };

  const handleSaveAdminBuyerFee = async (uid: string) => {
    const form = adminFeeForms[uid];
    if (!form) return;
    const rawType = form.fee_type;
    const num = parseFloat(String(form.fee_value).replace(',', '.'));
    if (rawType !== 'none' && (!Number.isFinite(num) || num <= 0)) {
      alert('Ingresa un valor numérico mayor que cero.');
      return;
    }
    setAdminFeeSaving(uid);
    try {
      await setOrganizerBuyerFee(uid, {
        fee_type:
          rawType === 'percent_payer' || rawType === 'fixed_per_ticket'
            ? rawType
            : 'none',
        fee_value: rawType === 'none' ? 0 : num,
      });
      const f = await getOrganizerBuyerFee(uid);
      setAdminFeeForms((prev) => ({
        ...prev,
        [uid]: {
          fee_type: f?.fee_type ?? 'none',
          fee_value: f != null ? String(f.fee_value) : '',
        },
      }));
      void appendAuditLog({
        kind: 'organizer_buyer_fee',
        entityType: 'organizer_buyer_fees',
        entityId: uid,
        summary: `Tarifa comprador organizador ${uid.slice(0, 8)}…: ${rawType}${rawType !== 'none' ? ` ${num}` : ''}`,
      }).catch(() => undefined);
    } catch (err) {
      alert(err instanceof Error ? err.message : 'No se pudo guardar la tarifa.');
    } finally {
      setAdminFeeSaving(null);
    }
  };

  const handleSaveMpSeller = async (uid: string) => {
    const raw = (mpSellerTokenInput[uid] || '').trim();
    if (!raw) {
      alert('Pega el access token de producción del organizador (Mercado Pago).');
      return;
    }
    setMpSellerSaving(uid);
    try {
      await setOrganizerMpSellerAccessToken(uid, raw);
      setMpSellerTokenInput((prev) => ({ ...prev, [uid]: '' }));
      setMpSellerConfigured((prev) => ({ ...prev, [uid]: true }));
      void appendAuditLog({
        kind: 'organizer_mp_seller',
        action: 'set',
        entityType: 'organizer_mp_seller',
        entityId: uid,
        summary: `Mercado Pago vendedor configurado para ${uid.slice(0, 8)}…`,
      }).catch(() => undefined);
    } catch (err) {
      alert(err instanceof Error ? err.message : 'No se pudo guardar el token.');
    } finally {
      setMpSellerSaving(null);
    }
  };

  const handleClearMpSeller = async (uid: string) => {
    if (
      !confirm(
        '¿Quitar la cuenta Mercado Pago de este organizador? Los pagos volverán a usar solo la credencial global de la plataforma (sin split por organizador).'
      )
    ) {
      return;
    }
    setMpSellerSaving(uid);
    try {
      await clearOrganizerMpSellerAccessToken(uid);
      setMpSellerConfigured((prev) => ({ ...prev, [uid]: false }));
      void appendAuditLog({
        kind: 'organizer_mp_seller',
        action: 'clear',
        entityType: 'organizer_mp_seller',
        entityId: uid,
        summary: `Mercado Pago vendedor quitado para ${uid.slice(0, 8)}…`,
      }).catch(() => undefined);
    } catch (err) {
      alert(err instanceof Error ? err.message : 'No se pudo quitar la cuenta.');
    } finally {
      setMpSellerSaving(null);
    }
  };

  const handleToggleAdminActive = async (uid: string, active: boolean) => {
    const self = getCurrentUser();
    if (self?.uid === uid) {
      alert('No puedes desactivarte a ti mismo desde aquí.');
      return;
    }
    if (!confirm(active ? '¿Reactivar este administrador?' : '¿Dar de baja (desactivar) este administrador?')) return;
    setAdminActionId(uid);
    try {
      await updateUserDocument(uid, { active });
      setAdmins(await getAdminUsersList());
    } catch (err) {
      alert(err instanceof Error ? err.message : 'No se pudo actualizar el usuario.');
    } finally {
      setAdminActionId(null);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(false);
    const raw = whatsappPhone.trim().replace(/\D/g, '');
    if (!raw) {
      setError('Ingresa el número de WhatsApp (solo dígitos, con código de país).');
      return;
    }
    setSaving(true);
    try {
      await updateContactConfig({ whatsappPhone: raw });
      void appendAuditLog({
        kind: 'config_contact',
        entityType: 'configurations',
        entityId: 'contact_config',
        summary: `WhatsApp público actualizado (${raw.length} dígitos)`,
      }).catch(() => undefined);
      setSuccess(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al guardar.');
    } finally {
      setSaving(false);
    }
  };

  const handleSavePaymentProvider = async () => {
    setPaymentProviderSaving(true);
    try {
      await updatePaymentProviderConfig(paymentProvider);
      void appendAuditLog({
        kind: 'config_payment_provider',
        entityType: 'configurations',
        entityId: 'payments_config',
        summary: `Pasarela checkout: ${paymentProvider === 'onepay' ? 'OnePay' : 'Mercado Pago'}`,
      }).catch(() => undefined);
    } catch (err) {
      alert(err instanceof Error ? err.message : 'No se pudo guardar la pasarela.');
    } finally {
      setPaymentProviderSaving(false);
    }
  };

  const handleLogout = async () => {
    try {
      await logoutUser();
    } catch (e) {
      console.error(e);
    }
  };

  if (loading) {
    return (
      <div className="config-screen">
        <TopNavBar logoOnly showLogout onLogout={handleLogout} />
        <div className="config-hub">
          <div className="config-hub__loading">
            <span className="config-hub__loading-dot" aria-hidden />
            <p>Cargando centro de configuración…</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="config-screen">
      <TopNavBar logoOnly showLogout onLogout={handleLogout} />
      <div className="config-hub">
        <header className="config-hub__hero">
          <div className="config-hub__hero-main">
            <p className="config-hub__eyebrow">Ticket Colombia · Panel</p>
            <h1 className="config-hub__title">Centro de configuración</h1>
            <p className="config-hub__lede">
              {superAdmin
                ? 'Organiza el contacto público, accede a los módulos del sistema y gestiona administradores desde un solo lugar.'
                : 'Ajusta el contacto por WhatsApp y entra a las secciones que tienes habilitadas.'}
            </p>
          </div>
          <div className="config-hub__hero-aside">
            <span className={`config-hub__role-badge ${superAdmin ? 'config-hub__role-badge--super' : ''}`}>
              {superAdmin ? 'Super administrador' : 'Administrador'}
            </span>
            <SecondaryButton type="button" size="small" onClick={() => navigate('/dashboard')}>
              ← Volver al inicio
            </SecondaryButton>
          </div>
        </header>

        <section className="config-hub__section" aria-labelledby="config-section-contacto">
          <div className="config-hub__section-head">
            <h2 id="config-section-contacto" className="config-hub__section-title">
              <span className="config-hub__section-icon" aria-hidden>
                <IconHubContact size={16} />
              </span>
              Contacto público
            </h2>
            <p className="config-hub__section-desc">
              WhatsApp desde la landing y el botón de contacto. Incluye código de país sin + (ej. 573001234567).
            </p>
          </div>
          <div className="config-module config-module--surface">
            <form onSubmit={handleSubmit} className="config-form">
              <CustomInput
                type="tel"
                label="Número de WhatsApp"
                value={whatsappPhone}
                onChange={(e) => setWhatsappPhone(e.target.value)}
                placeholder="573001234567"
                required
              />
              {error && <p className="config-error">{error}</p>}
              {success && <p className="config-success">Cambios guardados correctamente.</p>}
              <div className="config-actions">
                <PrimaryButton type="submit" disabled={saving} loading={saving}>
                  Guardar contacto
                </PrimaryButton>
              </div>
            </form>
          </div>
        </section>

        {superAdmin && (
          <section className="config-hub__section config-hub__section--super" aria-labelledby="config-section-super">
            <div className="config-hub__section-head">
              <h2 id="config-section-super" className="config-hub__section-title">
                <span className="config-hub__section-icon" aria-hidden>
                  <IconHubSpark size={16} />
                </span>
                Control de plataforma
              </h2>
              <p className="config-hub__section-desc">
                Solo super administrador: comisiones, partners, registro de actividad y reglas que afectan a varios organizadores.
              </p>
            </div>
            <div className="config-tile-grid config-tile-grid--2">
              <button type="button" className="config-tile config-tile--accent" onClick={() => navigate('/super-admin/earnings')}>
                <span className="config-tile__glyph" aria-hidden>
                  <IconStats size={24} />
                </span>
                <span className="config-tile__body">
                  <span className="config-tile__name">Comisiones tiquetera</span>
                  <span className="config-tile__hint">Tarifas por evento y reglas de la plataforma.</span>
                </span>
                <span className="config-tile__arrow" aria-hidden>
                  <IconHubChevronRight size={20} />
                </span>
              </button>
              <button type="button" className="config-tile config-tile--accent" onClick={() => navigate('/super-admin/partners')}>
                <span className="config-tile__glyph" aria-hidden>
                  <IconHubHandshake size={24} />
                </span>
                <span className="config-tile__body">
                  <span className="config-tile__name">Usuarios partner</span>
                  <span className="config-tile__hint">Permisos por evento: boletos, stats, edición, taquilla.</span>
                </span>
                <span className="config-tile__arrow" aria-hidden>
                  <IconHubChevronRight size={20} />
                </span>
              </button>
              <button type="button" className="config-tile config-tile--accent" onClick={() => navigate('/super-admin/audit-log')}>
                <span className="config-tile__glyph" aria-hidden>
                  <IconHubBolt size={24} />
                </span>
                <span className="config-tile__body">
                  <span className="config-tile__name">Registro de actividad</span>
                  <span className="config-tile__hint">Auditoría por fechas y usuario; eventos, boletos y config crítica.</span>
                </span>
                <span className="config-tile__arrow" aria-hidden>
                  <IconHubChevronRight size={20} />
                </span>
              </button>
            </div>

            <div className="config-module config-module--surface" style={{ marginTop: '1.25rem' }}>
              <h3 style={{ margin: '0 0 0.5rem', fontSize: '1.05rem' }}>Pasarela de pago (checkout)</h3>
              <p className="helper-text" style={{ marginBottom: '1rem' }}>
                Define si las compras en la app usan Mercado Pago u OnePay. Los secretos de API y webhook se configuran en
                Firebase (Functions), no aquí.
              </p>
              <div className="config-form" style={{ gap: '0.75rem' }}>
                <CustomSelector
                  name="payment_provider"
                  label="Proveedor en línea"
                  value={paymentProvider}
                  options={[
                    { value: 'mercadopago', label: 'Mercado Pago' },
                    { value: 'onepay', label: 'OnePay' },
                  ]}
                  onChange={(e) =>
                    setPaymentProvider(e.target.value === 'onepay' ? 'onepay' : 'mercadopago')
                  }
                />
                <div>
                  <p className="helper-text" style={{ margin: '0 0 0.35rem' }}>
                    URL del webhook para registrar en el panel de OnePay (eventos de cobro):
                  </p>
                  <code
                    style={{
                      display: 'block',
                      padding: '0.65rem 0.75rem',
                      borderRadius: 8,
                      background: 'var(--color-surface-muted, #f4f4f5)',
                      fontSize: '0.85rem',
                      wordBreak: 'break-all',
                    }}
                  >
                    {getOnePayWebhookUrl()}
                  </code>
                  <p className="helper-text" style={{ marginTop: '0.5rem' }}>
                    Si tu proyecto o la función usan otra URL, define{' '}
                    <code>VITE_ONEPAY_WEBHOOK_URL</code> al construir el admin.
                  </p>
                </div>
                <PrimaryButton
                  type="button"
                  disabled={paymentProviderSaving}
                  loading={paymentProviderSaving}
                  onClick={() => void handleSavePaymentProvider()}
                >
                  Guardar pasarela
                </PrimaryButton>
              </div>
            </div>
          </section>
        )}

        <section className="config-hub__section" aria-labelledby="config-section-rapidos">
          <div className="config-hub__section-head">
            <h2 id="config-section-rapidos" className="config-hub__section-title">
              <span className="config-hub__section-icon" aria-hidden>
                <IconHubBolt size={16} />
              </span>
              Accesos rápidos
            </h2>
            <p className="config-hub__section-desc">Módulos que usas en el día a día del panel.</p>
          </div>
          <div className="config-tile-grid config-tile-grid--2">
            {superAdmin && (
              <button type="button" className="config-tile" onClick={() => navigate('/banners')}>
                <span className="config-tile__glyph" aria-hidden>
                  <IconHubImage size={24} />
                </span>
                <span className="config-tile__body">
                  <span className="config-tile__name">Banners del sitio</span>
                  <span className="config-tile__hint">Carrusel e imágenes de la página principal.</span>
                </span>
                <span className="config-tile__arrow" aria-hidden>
                  <IconHubChevronRight size={20} />
                </span>
              </button>
            )}
            <button type="button" className="config-tile" onClick={() => navigate('/balance')}>
              <span className="config-tile__glyph" aria-hidden>
                <IconHubWallet size={24} />
              </span>
              <span className="config-tile__body">
                <span className="config-tile__name">Balance y egresos</span>
                <span className="config-tile__hint">Resumen financiero y movimientos.</span>
              </span>
              <span className="config-tile__arrow" aria-hidden>
                <IconHubChevronRight size={20} />
              </span>
            </button>
          </div>
        </section>

        {superAdmin && (
          <section className="config-hub__section" aria-labelledby="config-section-admins">
            <div className="config-hub__section-head">
              <h2 id="config-section-admins" className="config-hub__section-title">
                <span className="config-hub__section-icon" aria-hidden>
                  <IconHubUsers size={17} />
                </span>
                Organizadores y administradores
              </h2>
              <p className="config-hub__section-desc">
                Taquilla y eventos: tarifa de servicio al comprador por organizador, eventos asignados y{' '}
                <strong>reasignación</strong> si cambia el responsable. Si un evento tiene comisión propia, prevalece;
                si no, aplica la tarifa del admin o la global en <code>configurations/payments_config</code>.
              </p>
            </div>
            <div className="config-card config-card--super">
            {adminsLoading ? (
              <p className="config-admin-muted">Cargando administradores…</p>
            ) : admins.length === 0 ? (
              <p className="config-admin-muted">No hay administradores con rol ADMIN en el listado.</p>
            ) : (
              <ul className="config-admin-cards">
                {admins.map((a) => {
                  const standaloneList = organizerEventsIndex?.standalone[a.uid] ?? [];
                  const recurringList = organizerEventsIndex?.recurring[a.uid] ?? [];
                  const totalEv = standaloneList.length + recurringList.length;
                  const initial = (a.name?.trim()?.charAt(0) || a.email?.charAt(0) || '?').toUpperCase();
                  return (
                    <li key={a.uid} className="config-admin-card">
                      <div className="config-admin-card__top">
                        <div className="config-admin-card__avatar" aria-hidden>
                          {initial}
                        </div>
                        <div className="config-admin-card__info">
                          <div className="config-admin-card__name">{a.name?.trim() || 'Sin nombre'}</div>
                          <div className="config-admin-card__email">{a.email}</div>
                          <div className="config-admin-card__chips">
                            <span className="config-admin-chip">{a.role || 'ADMIN'}</span>
                            {a.active === false ? (
                              <span className="config-admin-chip config-admin-chip--danger">Inactivo</span>
                            ) : (
                              <span className="config-admin-chip config-admin-chip--ok">Activo</span>
                            )}
                            <span className="config-admin-chip config-admin-chip--muted">
                              {organizerEventsLoading
                                ? '…'
                                : `${totalEv} evento${totalEv === 1 ? '' : 's'}`}
                            </span>
                          </div>
                        </div>
                        <SecondaryButton
                          type="button"
                          size="small"
                          disabled={adminActionId === a.uid}
                          onClick={() => handleToggleAdminActive(a.uid, a.active === false)}
                        >
                          {a.active === false ? 'Reactivar' : 'Dar de baja'}
                        </SecondaryButton>
                      </div>

                      <div className="config-admin-card__events-block">
                        <h2 className="config-admin-card__events-heading">Eventos de este organizador</h2>
                        {organizerEventsLoading ? (
                          <p className="config-admin-muted">Cargando eventos…</p>
                        ) : totalEv === 0 ? (
                          <p className="config-admin-muted">Ningún evento enlazado a este usuario.</p>
                        ) : (
                          <ul className="config-admin-event-list">
                            {standaloneList.map((ev) => (
                              <li key={ev.id} className="config-admin-event-item">
                                <div className="config-admin-event-item__text">
                                  <span className="config-admin-event-item__kind">Evento</span>
                                  <span className="config-admin-event-item__title">{ev.name}</span>
                                  <span className="config-admin-event-item__meta">{eventRowMeta(ev)}</span>
                                </div>
                                <div className="config-admin-event-item__btns">
                                  <SecondaryButton
                                    type="button"
                                    size="small"
                                    onClick={() => navigate(`/events/${ev.id}`)}
                                  >
                                    Abrir
                                  </SecondaryButton>
                                  <SecondaryButton
                                    type="button"
                                    size="small"
                                    onClick={() => openTransfer('events', ev, a.uid)}
                                  >
                                    Cambiar admin
                                  </SecondaryButton>
                                </div>
                                {transferOpen?.coll === 'events' &&
                                  transferOpen.id === ev.id &&
                                  transferOpen.fromUid === a.uid && (
                                    <div className="config-admin-transfer">
                                      {adminSelectOptions.filter((o) => o.value !== a.uid).length === 0 ? (
                                        <p className="config-admin-muted">
                                          Añade otro administrador en Firestore para poder reasignar.
                                        </p>
                                      ) : (
                                        <CustomSelector
                                          name="transfer-event-organizer"
                                          label="Reasignar a"
                                          value={transferPickUid}
                                          options={adminSelectOptions.filter((o) => o.value !== a.uid)}
                                          onChange={(e) => setTransferPickUid(String(e.target.value))}
                                        />
                                      )}
                                      <div className="config-admin-transfer__actions">
                                        <PrimaryButton
                                          type="button"
                                          size="small"
                                          disabled={
                                            transferSaving ||
                                            !transferPickUid ||
                                            adminSelectOptions.filter((o) => o.value !== a.uid).length === 0
                                          }
                                          loading={transferSaving}
                                          onClick={() => void handleApplyTransfer()}
                                        >
                                          Aplicar
                                        </PrimaryButton>
                                        <SecondaryButton
                                          type="button"
                                          size="small"
                                          disabled={transferSaving}
                                          onClick={() => {
                                            setTransferOpen(null);
                                            setTransferPickUid('');
                                          }}
                                        >
                                          Cancelar
                                        </SecondaryButton>
                                      </div>
                                    </div>
                                  )}
                              </li>
                            ))}
                            {recurringList.map((ev) => (
                              <li key={ev.id} className="config-admin-event-item">
                                <div className="config-admin-event-item__text">
                                  <span className="config-admin-event-item__kind config-admin-event-item__kind--rec">
                                    Recurrente
                                  </span>
                                  <span className="config-admin-event-item__title">{ev.name}</span>
                                  <span className="config-admin-event-item__meta">{eventRowMeta(ev)}</span>
                                </div>
                                <div className="config-admin-event-item__btns">
                                  <SecondaryButton
                                    type="button"
                                    size="small"
                                    onClick={() => navigate(`/recurring-events/${ev.id}`)}
                                  >
                                    Abrir
                                  </SecondaryButton>
                                  <SecondaryButton
                                    type="button"
                                    size="small"
                                    onClick={() => openTransfer('recurring_events', ev, a.uid)}
                                  >
                                    Cambiar admin
                                  </SecondaryButton>
                                </div>
                                {transferOpen?.coll === 'recurring_events' &&
                                  transferOpen.id === ev.id &&
                                  transferOpen.fromUid === a.uid && (
                                    <div className="config-admin-transfer">
                                      {adminSelectOptions.filter((o) => o.value !== a.uid).length === 0 ? (
                                        <p className="config-admin-muted">
                                          Añade otro administrador en Firestore para poder reasignar.
                                        </p>
                                      ) : (
                                        <CustomSelector
                                          name="transfer-recurring-organizer"
                                          label="Reasignar a"
                                          value={transferPickUid}
                                          options={adminSelectOptions.filter((o) => o.value !== a.uid)}
                                          onChange={(e) => setTransferPickUid(String(e.target.value))}
                                        />
                                      )}
                                      <div className="config-admin-transfer__actions">
                                        <PrimaryButton
                                          type="button"
                                          size="small"
                                          disabled={
                                            transferSaving ||
                                            !transferPickUid ||
                                            adminSelectOptions.filter((o) => o.value !== a.uid).length === 0
                                          }
                                          loading={transferSaving}
                                          onClick={() => void handleApplyTransfer()}
                                        >
                                          Aplicar
                                        </PrimaryButton>
                                        <SecondaryButton
                                          type="button"
                                          size="small"
                                          disabled={transferSaving}
                                          onClick={() => {
                                            setTransferOpen(null);
                                            setTransferPickUid('');
                                          }}
                                        >
                                          Cancelar
                                        </SecondaryButton>
                                      </div>
                                    </div>
                                  )}
                              </li>
                            ))}
                          </ul>
                        )}
                      </div>

                      <div className="config-admin-fee config-admin-fee--card">
                        <span className="config-admin-fee__label">Tarifa de servicio al comprador (por defecto)</span>
                        <div className="config-admin-fee__controls">
                          <select
                            className="config-admin-fee__select"
                            value={adminFeeForms[a.uid]?.fee_type ?? 'none'}
                            onChange={(e) =>
                              setAdminFeeForms((prev) => ({
                                ...prev,
                                [a.uid]: {
                                  fee_type: e.target.value,
                                  fee_value: prev[a.uid]?.fee_value ?? '',
                                },
                              }))
                            }
                          >
                            <option value="none">Solo tarifa global de la plataforma</option>
                            <option value="percent_payer">% sobre subtotal (como la global)</option>
                            <option value="fixed_per_ticket">COP fijos por entrada</option>
                          </select>
                          {(adminFeeForms[a.uid]?.fee_type === 'percent_payer' ||
                            adminFeeForms[a.uid]?.fee_type === 'fixed_per_ticket') && (
                            <input
                              type="number"
                              className="config-admin-fee__input"
                              min={0}
                              step={adminFeeForms[a.uid]?.fee_type === 'percent_payer' ? 0.1 : 1}
                              placeholder={
                                adminFeeForms[a.uid]?.fee_type === 'percent_payer' ? 'Ej: 9' : 'Ej: 5000'
                              }
                              value={adminFeeForms[a.uid]?.fee_value ?? ''}
                              onChange={(e) =>
                                setAdminFeeForms((prev) => ({
                                  ...prev,
                                  [a.uid]: {
                                    fee_type: prev[a.uid]?.fee_type ?? 'none',
                                    fee_value: e.target.value,
                                  },
                                }))
                              }
                            />
                          )}
                          <PrimaryButton
                            type="button"
                            size="small"
                            disabled={adminFeeSaving === a.uid}
                            loading={adminFeeSaving === a.uid}
                            onClick={() => handleSaveAdminBuyerFee(a.uid)}
                          >
                            Guardar tarifa
                          </PrimaryButton>
                        </div>
                      </div>

                      <div className="config-admin-fee config-admin-fee--card">
                        <span className="config-admin-fee__label">Mercado Pago del organizador (split)</span>
                        <p className="config-admin-muted" style={{ marginTop: 8, marginBottom: 8 }}>
                          Si guardas el access token de producción del organizador y el evento tiene{' '}
                          <code>organizer_id</code> apuntando a este usuario, el checkout usa ese vendedor.
                          La parte de <strong>tarifa de servicio al comprador</strong> (la que ya configuras
                          arriba o por evento) se envía como <code>marketplace_fee</code> para la tiquetera;
                          el resto queda para el organizador (después de comisiones MP). Activa el producto{' '}
                          Marketplace en tu aplicación de desarrolladores MP y vincula vendedores vía OAuth (o
                          token del usuario vendedor si MP lo permite en tu modelo).
                        </p>
                        <div className="config-admin-fee__controls" style={{ flexWrap: 'wrap', gap: 8 }}>
                          {mpSellerConfigured[a.uid] ? (
                            <span className="config-admin-chip config-admin-chip--ok">Cuenta MP vinculada</span>
                          ) : (
                            <span className="config-admin-chip config-admin-chip--muted">
                              Sin cuenta propia (solo credencial global de la función)
                            </span>
                          )}
                          <input
                            type="password"
                            className="config-admin-fee__input"
                            style={{ minWidth: 220, flex: 1 }}
                            autoComplete="off"
                            placeholder="ACCESS_TOKEN producción del organizador"
                            value={mpSellerTokenInput[a.uid] ?? ''}
                            onChange={(e) =>
                              setMpSellerTokenInput((prev) => ({ ...prev, [a.uid]: e.target.value }))
                            }
                          />
                          <PrimaryButton
                            type="button"
                            size="small"
                            disabled={mpSellerSaving === a.uid}
                            loading={mpSellerSaving === a.uid}
                            onClick={() => void handleSaveMpSeller(a.uid)}
                          >
                            Guardar token
                          </PrimaryButton>
                          {mpSellerConfigured[a.uid] && (
                            <SecondaryButton
                              type="button"
                              size="small"
                              disabled={mpSellerSaving === a.uid}
                              onClick={() => void handleClearMpSeller(a.uid)}
                            >
                              Quitar
                            </SecondaryButton>
                          )}
                        </div>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
            </div>
          </section>
        )}
      </div>
    </div>
  );
};

export default ConfigScreen;
