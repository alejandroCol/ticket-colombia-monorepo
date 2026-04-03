import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import TopNavBar from '@containers/TopNavBar';
import PrimaryButton from '@components/PrimaryButton';
import SecondaryButton from '@components/SecondaryButton';
import CustomInput from '@components/CustomInput';
import type { PartnerEventPermissions } from '@services';
import {
  changePasswordWithCurrent,
  logoutUser,
  getCurrentUser,
  getUserData,
  listPartnerGrantsForUser,
  isSuperAdmin,
  DEFAULT_PARTNER_PERMISSIONS,
} from '@services';
import './index.scss';

const AccountChangePasswordScreen: React.FC = () => {
  const navigate = useNavigate();
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const u = getCurrentUser();
  const email = u?.email?.trim() ?? '';

  const [navOpts, setNavOpts] = useState({
    showConfig: true,
    showScan: true,
    showTaquilla: false,
  });

  useEffect(() => {
    const user = getCurrentUser();
    if (!user?.uid) return;
    let cancelled = false;
    void (async () => {
      const [data, superAdmin] = await Promise.all([getUserData(user.uid), isSuperAdmin(user.uid)]);
      if (cancelled) return;
      const partner = data?.role === 'PARTNER';
      if (!partner || superAdmin) {
        setNavOpts(DEFAULT_ADMIN_NAV_OPTS);
        return;
      }
      const grants = await listPartnerGrantsForUser(user.uid);
      if (cancelled) return;
      const grantMap: Record<string, PartnerEventPermissions> = {};
      for (const g of grants) {
        const cur = grantMap[g.event_id] || { ...DEFAULT_PARTNER_PERMISSIONS };
        grantMap[g.event_id] = {
          read_tickets: cur.read_tickets || g.permissions.read_tickets,
          create_tickets: cur.create_tickets || g.permissions.create_tickets,
          taquilla_sale: cur.taquilla_sale || g.permissions.taquilla_sale,
          edit_event: cur.edit_event || g.permissions.edit_event,
          view_stats: cur.view_stats || g.permissions.view_stats,
          scan_validate: cur.scan_validate || g.permissions.scan_validate,
        };
      }
      const scanAny = Object.values(grantMap).some((p) => p.scan_validate);
      const taquillaAny = Object.values(grantMap).some((p) => p.taquilla_sale || p.create_tickets);
      setNavOpts({
        showConfig: false,
        showScan: scanAny,
        showTaquilla: taquillaAny,
      });
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const handleLogout = async () => {
    await logoutUser();
    navigate('/login');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(false);
    if (!email) {
      setError(
        'Tu cuenta no tiene correo asociado para reautenticación. Usa recuperación de contraseña o contacta soporte.'
      );
      return;
    }
    if (newPassword !== confirmPassword) {
      setError('La confirmación no coincide con la nueva contraseña.');
      return;
    }
    setSaving(true);
    try {
      await changePasswordWithCurrent(currentPassword, newPassword);
      setSuccess(true);
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al cambiar la contraseña.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="account-password-screen">
      <TopNavBar
        logoOnly
        showLogout
        onLogout={handleLogout}
        adminNavOptions={navOpts}
      />
      <div className="account-password-screen__wrap">
        <div className="account-password-screen__card">
          <h1 className="account-password-screen__title">Cambiar contraseña</h1>
          <p className="account-password-screen__lede">
            Ingresa tu contraseña actual y elige una nueva. Mínimo 6 caracteres (recomendamos más para mayor
            seguridad).
          </p>
          {email ? (
            <p className="account-password-screen__email">
              Cuenta: <strong>{email}</strong>
            </p>
          ) : null}

          <form onSubmit={(e) => void handleSubmit(e)} className="account-password-screen__form">
            <CustomInput
              type="password"
              label="Contraseña actual"
              value={currentPassword}
              onChange={(ev) => setCurrentPassword(ev.target.value)}
              autoComplete="current-password"
              showPasswordToggle
            />
            <CustomInput
              type="password"
              label="Nueva contraseña"
              value={newPassword}
              onChange={(ev) => setNewPassword(ev.target.value)}
              autoComplete="new-password"
              showPasswordToggle
            />
            <CustomInput
              type="password"
              label="Confirmar nueva contraseña"
              value={confirmPassword}
              onChange={(ev) => setConfirmPassword(ev.target.value)}
              autoComplete="new-password"
              showPasswordToggle
            />
            {error ? <p className="account-password-screen__error">{error}</p> : null}
            {success ? (
              <p className="account-password-screen__success">Contraseña actualizada correctamente.</p>
            ) : null}
            <div className="account-password-screen__actions">
              <PrimaryButton type="submit" disabled={saving}>
                {saving ? 'Guardando…' : 'Guardar nueva contraseña'}
              </PrimaryButton>
              <SecondaryButton type="button" onClick={() => navigate('/dashboard')} disabled={saving}>
                Volver al panel
              </SecondaryButton>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

/** Alineado con dashboard: taquilla visible para no-partner. */
const DEFAULT_ADMIN_NAV_OPTS = {
  showConfig: true,
  showScan: true,
  showTaquilla: true,
};

export default AccountChangePasswordScreen;
