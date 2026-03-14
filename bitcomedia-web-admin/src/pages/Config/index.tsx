import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import TopNavBar from '@containers/TopNavBar';
import PrimaryButton from '@components/PrimaryButton';
import SecondaryButton from '@components/SecondaryButton';
import CustomInput from '@components/CustomInput';
import { getContactConfig, updateContactConfig, logoutUser } from '@services';
import './index.scss';

const ConfigScreen: React.FC = () => {
  const navigate = useNavigate();
  const [whatsappPhone, setWhatsappPhone] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

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
      </div>
    </div>
  );
};

export default ConfigScreen;
