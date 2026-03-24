import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import TopNavBar from '@containers/TopNavBar';
import PrimaryButton from '@components/PrimaryButton';
import SecondaryButton from '@components/SecondaryButton';
import CustomInput from '@components/CustomInput';
import {
  getContactConfig,
  updateContactConfig,
  logoutUser,
  getCurrentUser,
  isSuperAdmin,
  getAdminUsersList,
  updateUserDocument,
  getOrganizerBuyerFee,
  setOrganizerBuyerFee,
} from '@services';
import './index.scss';

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
    } catch (err) {
      alert(err instanceof Error ? err.message : 'No se pudo guardar la tarifa.');
    } finally {
      setAdminFeeSaving(null);
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
      setSuccess(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al guardar.');
    } finally {
      setSaving(false);
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
        <div className="config-content">
          <p>Cargando configuración...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="config-screen">
      <TopNavBar logoOnly showLogout onLogout={handleLogout} />
      <div className="config-content">
        <div className="config-card">
          <h1>Configuración de contacto</h1>
          <p className="config-description">
            Número de WhatsApp al que se redirige a los usuarios desde la landing y el botón de contacto.
            Incluye código de país sin + (ej: 573001234567 para Colombia).
          </p>
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
            {success && <p className="config-success">Guardado correctamente.</p>}
            <div className="config-links">
            <button
              type="button"
              className="config-link-btn"
              onClick={() => navigate('/banners')}
            >
              Gestionar banners de la página principal →
            </button>
            <button
              type="button"
              className="config-link-btn"
              onClick={() => navigate('/balance')}
            >
              Ver balance y egresos →
            </button>
            {superAdmin && (
              <button
                type="button"
                className="config-link-btn"
                onClick={() => navigate('/super-admin/earnings')}
              >
                Comisiones tiquetera por evento →
              </button>
            )}
          </div>
          <div className="config-actions">
              <SecondaryButton type="button" onClick={() => navigate('/dashboard')}>
                Volver
              </SecondaryButton>
              <PrimaryButton type="submit" disabled={saving} loading={saving}>
                Guardar
              </PrimaryButton>
            </div>
          </form>
        </div>

        {superAdmin && (
          <div className="config-card config-card--super">
            <h1>Administradores del panel</h1>
            <p className="config-description">
              Usuarios con rol administrador (taquilla / eventos). Puedes desactivarlos para impedir el acceso al panel.
              Aquí defines la <strong>tarifa de servicio al comprador</strong> por defecto para cada admin (porcentaje sobre el
              subtotal o valor fijo por entrada). Si en un evento el super admin configuró una regla propia, esa prevalece
              sobre la del organizador; si no hay ninguna, se usa el porcentaje global en{' '}
              <code>configurations/payments_config</code>.
            </p>
            {adminsLoading ? (
              <p>Cargando administradores…</p>
            ) : admins.length === 0 ? (
              <p>No hay administradores adicionales listados.</p>
            ) : (
              <ul className="config-admin-list">
                {admins.map((a) => (
                  <li key={a.uid} className="config-admin-block">
                    <div className="config-admin-row">
                      <div>
                        <strong>{a.name || a.email}</strong>
                        <span className="config-admin-meta">{a.email}</span>
                        <span className="config-admin-meta">Rol: {a.role}</span>
                        {a.active === false && <span className="config-admin-badge">Inactivo</span>}
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
                    <div className="config-admin-fee">
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
                          <option value="none">Usar solo la tarifa global de la plataforma</option>
                          <option value="percent_payer">Porcentaje sobre subtotal (como la global)</option>
                          <option value="fixed_per_ticket">Valor fijo COP por entrada</option>
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
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default ConfigScreen;
