import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import TopNavBar from '@containers/TopNavBar';
import PrimaryButton from '@components/PrimaryButton';
import SecondaryButton from '@components/SecondaryButton';
import { getHomeBanners, saveHomeBanners, logoutUser, uploadFile } from '@services';
import type { BannerItem } from '@services';
import './index.scss';

const BannersScreen: React.FC = () => {
  const navigate = useNavigate();
  const [banners, setBanners] = useState<BannerItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    loadBanners();
  }, []);

  const loadBanners = async () => {
    try {
      setLoading(true);
      const data = await getHomeBanners();
      setBanners(data.length > 0 ? data : []);
    } catch (e) {
      setError('No se pudieron cargar los banners.');
    } finally {
      setLoading(false);
    }
  };

  const handleAddBanner = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !file.type.startsWith('image/')) return;

    setError(null);
    try {
      const path = `banners/${Date.now()}_${file.name}`;
      const url = await uploadFile(file, path);
      setBanners((prev) => [...prev, { url, order: prev.length }]);
      e.target.value = '';
    } catch (err) {
      setError('Error al subir la imagen.');
    }
  };

  const handleRemoveBanner = (index: number) => {
    setBanners((prev) => prev.filter((_, i) => i !== index));
  };

  const handleMoveBanner = (index: number, direction: 'up' | 'down') => {
    const newBanners = [...banners];
    const swap = direction === 'up' ? index - 1 : index + 1;
    if (swap < 0 || swap >= banners.length) return;
    [newBanners[index], newBanners[swap]] = [newBanners[swap], newBanners[index]];
    setBanners(newBanners.map((b, i) => ({ ...b, order: i })));
  };

  const handleSave = async () => {
    setError(null);
    setSuccess(false);
    setSaving(true);
    try {
      await saveHomeBanners(banners.map((b, i) => ({ ...b, order: i })));
      setSuccess(true);
    } catch (err) {
      setError('Error al guardar.');
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
      <div className="banners-screen">
        <TopNavBar logoOnly showLogout onLogout={handleLogout} />
        <div className="banners-content">
          <p>Cargando banners...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="banners-screen">
      <TopNavBar logoOnly showLogout onLogout={handleLogout} />
      <div className="banners-content">
        <div className="banners-card">
          <h1>Banners de la página principal</h1>
          <p className="banners-description">
            Las imágenes se deslizan cada 5 segundos en la página de inicio. Recomendado: 1200×400px o similar.
          </p>

          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            onChange={handleAddBanner}
            className="banners-file-input"
            style={{ display: 'none' }}
          />

          <div className="banners-actions">
            <PrimaryButton onClick={() => fileInputRef.current?.click()}>
              + Agregar banner
            </PrimaryButton>
            <SecondaryButton onClick={() => navigate('/config')}>
              Configuración
            </SecondaryButton>
          </div>

          {error && <p className="banners-error">{error}</p>}
          {success && <p className="banners-success">Banners guardados correctamente.</p>}

          <div className="banners-list">
            {banners.length === 0 ? (
              <p className="banners-empty">No hay banners. Agrega al menos uno.</p>
            ) : (
              banners.map((banner, index) => (
                <div key={index} className="banners-item">
                  <div className="banners-preview">
                    <img src={banner.url} alt={`Banner ${index + 1}`} />
                  </div>
                  <div className="banners-item-actions">
                    <button
                      type="button"
                      onClick={() => handleMoveBanner(index, 'up')}
                      disabled={index === 0}
                    >
                      ↑
                    </button>
                    <button
                      type="button"
                      onClick={() => handleMoveBanner(index, 'down')}
                      disabled={index === banners.length - 1}
                    >
                      ↓
                    </button>
                    <button
                      type="button"
                      className="remove"
                      onClick={() => handleRemoveBanner(index)}
                    >
                      Eliminar
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>

          {banners.length > 0 && (
            <div className="banners-save">
              <PrimaryButton onClick={handleSave} disabled={saving} loading={saving}>
                Guardar cambios
              </PrimaryButton>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default BannersScreen;
