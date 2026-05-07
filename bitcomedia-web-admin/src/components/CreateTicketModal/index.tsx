import React, { useState, useEffect, useMemo } from 'react';
import CustomInput from '@components/CustomInput';
import CustomSelector from '@components/CustomSelector';
import PrimaryButton from '@components/PrimaryButton';
import SecondaryButton from '@components/SecondaryButton';
import Loader from '@components/Loader';
import BulkUploadCortesiasModal from '@components/BulkUploadCortesiasModal';
import type { Event, VenueMapZone } from '@services/types';
import { getEventAvailability } from '@services';
import './index.scss';

function zonesForSelectedSection(event: Event, sectionId: string | undefined): VenueMapZone[] {
  if (!sectionId?.trim()) return [];
  const sid = String(sectionId).trim();
  return (event.venue_map?.zones ?? []).filter((z) => String(z.sectionId ?? '').trim() === sid);
}

interface CreateTicketModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (ticketData: TicketFormData) => Promise<void>;
  event: Event;
}

export interface TicketFormData {
  buyerName: string;
  buyerEmail: string;
  buyerPhone: string;
  buyerIdNumber: string;
  quantity: number;
  sectionId?: string;
  sectionName?: string;
  /** Obligatorio si la localidad tiene varias zonas/palcos en el mapa */
  mapZoneId?: string;
  mapZoneLabel?: string;
  isCourtesy?: boolean;
  isGeneralCourtesy?: boolean;
  giftedBy?: string;
}

const CreateTicketModal: React.FC<CreateTicketModalProps> = ({
  isOpen,
  onClose,
  onSubmit,
  event
}) => {
  const [formData, setFormData] = useState<TicketFormData>({
    buyerName: '',
    buyerEmail: '',
    buyerPhone: '',
    buyerIdNumber: '',
    quantity: 1,
    sectionId: undefined,
    sectionName: undefined,
    mapZoneId: undefined,
    mapZoneLabel: undefined,
    isCourtesy: false,
    isGeneralCourtesy: false,
    giftedBy: ''
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isBulkUploadOpen, setIsBulkUploadOpen] = useState(false);
  const [mapAvailLoading, setMapAvailLoading] = useState(false);
  const [mapZoneOccupancy, setMapZoneOccupancy] = useState<Record<string, number> | null>(null);
  const [availLoadFailed, setAvailLoadFailed] = useState(false);

  const sectionZones = useMemo(
    () =>
      formData.sectionId
        ? zonesForSelectedSection(event, formData.sectionId).sort(
            (a, b) => (Number(a.palco_index) || 0) - (Number(b.palco_index) || 0)
          )
        : [],
    [event, formData.sectionId]
  );
  const needsMapZonePick = sectionZones.length > 1;
  const selectedSectionRow = event.sections?.find((s) => s.id === formData.sectionId);
  const seatsPerUnit = Math.max(1, Number(selectedSectionRow?.seats_per_unit) || 1);

  useEffect(() => {
    if (!needsMapZonePick || !event.id?.trim()) {
      setMapZoneOccupancy(null);
      setMapAvailLoading(false);
      setAvailLoadFailed(false);
      return;
    }
    let cancelled = false;
    setMapAvailLoading(true);
    setMapZoneOccupancy(null);
    setAvailLoadFailed(false);
    void getEventAvailability(event.id)
      .then((a) => {
        if (!cancelled) setMapZoneOccupancy(a.byMapZone || {});
      })
      .catch(() => {
        if (!cancelled) {
          setMapZoneOccupancy(null);
          setAvailLoadFailed(true);
        }
      })
      .finally(() => {
        if (!cancelled) setMapAvailLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [needsMapZonePick, event.id, formData.sectionId]);

  const availableSectionZones = useMemo(() => {
    if (!needsMapZonePick || mapAvailLoading || availLoadFailed || mapZoneOccupancy === null) return [];
    return sectionZones.filter((z) => (mapZoneOccupancy[z.id] ?? 0) < 1);
  }, [needsMapZonePick, sectionZones, mapZoneOccupancy, mapAvailLoading, availLoadFailed]);

  useEffect(() => {
    if (!formData.mapZoneId || mapAvailLoading || mapZoneOccupancy === null) return;
    const ok = availableSectionZones.some((z) => z.id === formData.mapZoneId);
    if (!ok) {
      setFormData((prev) => ({ ...prev, mapZoneId: undefined, mapZoneLabel: undefined }));
    }
  }, [formData.mapZoneId, availableSectionZones, mapAvailLoading, mapZoneOccupancy]);

  // Calcular precio: cortesía = 0, sino basado en sección o precio por defecto
  const getTicketPrice = (): number => {
    if (formData.isCourtesy) return 0;
    if (formData.sectionId && event.sections) {
      const selectedSection = event.sections.find(s => s.id === formData.sectionId);
      return selectedSection?.price || event.ticket_price;
    }
    return event.ticket_price;
  };

  const handleChange = (field: keyof TicketFormData, value: string | number | boolean) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
    setError(null);
  };

  const validateForm = (): boolean => {
    if (!formData.buyerName.trim()) {
      setError('El nombre del comprador es requerido');
      return false;
    }
    if (!formData.buyerEmail.trim()) {
      setError('El correo electrónico es requerido');
      return false;
    }
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(formData.buyerEmail)) {
      setError('El correo electrónico no es válido');
      return false;
    }
    if (event.sections && event.sections.length > 0 && !formData.sectionId) {
      setError('Selecciona una localidad');
      return false;
    }
    if (needsMapZonePick) {
      if (mapAvailLoading) {
        setError('Espera a que cargue la lista de mesas disponibles.');
        return false;
      }
      if (availLoadFailed) {
        setError('No se pudo consultar disponibilidad de mesas. Cierra el modal y vuelve a intentar.');
        return false;
      }
      if (!availableSectionZones.length) {
        setError(
          'No quedan celdas libres en esta localidad para asignación manual (coincide con la tienda).'
        );
        return false;
      }
      if (!formData.mapZoneId?.trim()) {
        setError('Selecciona la mesa o palco concreto (celda del mapa)');
        return false;
      }
      if (!availableSectionZones.some((z) => z.id === formData.mapZoneId)) {
        setError('Esa celda ya no está disponible. Elige otra.');
        return false;
      }
      if (formData.quantity !== seatsPerUnit) {
        setError(
          `Esta localidad está dividida en el mapa: la cantidad debe ser ${seatsPerUnit} (celda completa, igual que en la tienda).`
        );
        return false;
      }
    } else if (formData.quantity < 1 || formData.quantity > 10) {
      setError('La cantidad debe estar entre 1 y 10');
      return false;
    }
    return true;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateForm()) {
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      await onSubmit(formData);
      // Resetear formulario
      setFormData({
        buyerName: '',
        buyerEmail: '',
        buyerPhone: '',
        buyerIdNumber: '',
        quantity: 1,
        sectionId: undefined,
        sectionName: undefined,
        mapZoneId: undefined,
        mapZoneLabel: undefined,
        isCourtesy: false,
        isGeneralCourtesy: false,
        giftedBy: ''
      });
      onClose();
    } catch (err: any) {
      console.error('Error creating manual ticket:', err);
      setError(err.message || 'Error al crear el ticket. Intente de nuevo.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCancel = () => {
    setFormData({
      buyerName: '',
      buyerEmail: '',
      buyerPhone: '',
      buyerIdNumber: '',
      quantity: 1,
      sectionId: undefined,
      sectionName: undefined,
      mapZoneId: undefined,
      mapZoneLabel: undefined,
      isCourtesy: false,
      isGeneralCourtesy: false,
      giftedBy: ''
    });
    setError(null);
    onClose();
  };

  const handleSectionChange = (sectionIdValue: string) => {
    const selected = event.sections?.find((s) => s.id === sectionIdValue);
    const zones = sectionIdValue ? zonesForSelectedSection(event, sectionIdValue) : [];
    const divided = zones.length > 1;
    const spu = Math.max(1, Number(selected?.seats_per_unit) || 1);
    setFormData((prev) => ({
      ...prev,
      sectionId: sectionIdValue || undefined,
      sectionName: selected?.name || undefined,
      mapZoneId: undefined,
      mapZoneLabel: undefined,
      quantity: divided ? spu : prev.quantity < 1 ? 1 : Math.min(10, prev.quantity),
    }));
  };

  const handleMapZoneChange = (zoneId: string) => {
    const z = sectionZones.find((zz) => zz.id === zoneId);
    const label =
      (z?.label && z.label.trim()) ||
      (z?.palco_index !== undefined ? `Mesa ${z.palco_index}` : '') ||
      zoneId.slice(0, 12);
    setFormData((prev) => ({
      ...prev,
      mapZoneId: zoneId || undefined,
      mapZoneLabel: zoneId ? label : undefined,
    }));
    setError(null);
  };

  if (!isOpen) return null;

  const ticketPrice = getTicketPrice();
  const purchaseGroups = needsMapZonePick ? 1 : formData.quantity;
  const totalAmount = ticketPrice * purchaseGroups;
  const qrCountInEmail = needsMapZonePick ? seatsPerUnit : formData.quantity;

  return (
    <div className="modal-overlay" onClick={handleCancel}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        {isSubmitting && (
          <div className="loader-overlay">
            <Loader />
            <p className="loader-text">Creando ticket y enviando correo...</p>
          </div>
        )}
        <div className="modal-header">
          <h2>Crear Ticket Manual</h2>
          <button className="close-button" onClick={handleCancel}>✕</button>
        </div>

        <div className="modal-body">
          <div className="event-info">
            <p className="event-name">📍 {event.name}</p>
            {event.sections && event.sections.length > 0 ? (
              <p className="event-price">💰 Selecciona una localidad</p>
            ) : (
              <p className="event-price">💰 Precio: ${event.ticket_price.toLocaleString('es-CO')} COP</p>
            )}
          </div>

          <div className="create-ticket-options">
            <SecondaryButton
              type="button"
              onClick={() => setIsBulkUploadOpen(true)}
              className="excel-upload-btn"
            >
              📤 Cargar cortesías desde Excel
            </SecondaryButton>
          </div>

          <form onSubmit={handleSubmit}>
            {event.sections && event.sections.length > 0 && (
              <CustomSelector
                label="Localidad *"
                value={formData.sectionId || ''}
                onChange={(e) => handleSectionChange(e.target.value)}
                options={[
                  { value: '', label: 'Selecciona una localidad' },
                  ...event.sections.map(section => ({
                    value: section.id,
                    label: `${section.name} - ${section.available} disponibles - $${section.price.toLocaleString('es-CO')}`
                  }))
                ]}
                required
              />
            )}

            {formData.sectionId && needsMapZonePick && availLoadFailed && (
              <p className="helper-text" role="alert" style={{ marginBottom: '0.75rem', color: '#e88' }}>
                No se pudo consultar ocupación del mapa. Reintenta más tarde o recarga la página.
              </p>
            )}

            {formData.sectionId && needsMapZonePick && mapAvailLoading && (
              <p className="helper-text" style={{ marginBottom: '0.75rem' }}>
                Consultando celdas disponibles…
              </p>
            )}

            {formData.sectionId &&
              needsMapZonePick &&
              !mapAvailLoading &&
              !availLoadFailed &&
              mapZoneOccupancy !== null &&
              !availableSectionZones.length && (
                <p className="helper-text" role="alert" style={{ marginBottom: '0.75rem', color: '#e88' }}>
                  No hay mesas/palcos libres en esta localidad por ahora (misma disponibilidad que en la tienda).
                </p>
              )}

            {formData.sectionId &&
              needsMapZonePick &&
              !mapAvailLoading &&
              !availLoadFailed &&
              !!availableSectionZones.length && (
                <CustomSelector
                  label="Mesa / palco en el mapa *"
                  value={formData.mapZoneId || ''}
                  onChange={(e) => handleMapZoneChange(e.target.value)}
                  options={[
                    { value: '', label: 'Selecciona una celda disponible' },
                    ...availableSectionZones.map((z) => ({
                      value: z.id,
                      label:
                        (z.label && z.label.trim()) ||
                        (z.palco_index !== undefined ? `Número ${z.palco_index}` : z.id.slice(0, 10)),
                    })),
                  ]}
                  required
                />
              )}

            <CustomInput
              label="Nombre del comprador *"
              type="text"
              value={formData.buyerName}
              onChange={(e) => handleChange('buyerName', e.target.value)}
              placeholder="Ej: Juan Pérez"
              required
            />

            <CustomInput
              label="Cédula *"
              type="text"
              value={formData.buyerIdNumber}
              onChange={(e) => handleChange('buyerIdNumber', e.target.value)}
              placeholder="Ej: 1234567890"
              required
            />

            <CustomInput
              label="Correo electrónico *"
              type="email"
              value={formData.buyerEmail}
              onChange={(e) => handleChange('buyerEmail', e.target.value)}
              placeholder="Ej: juan@ejemplo.com"
              required
            />

            <CustomInput
              label="Teléfono (opcional)"
              type="tel"
              value={formData.buyerPhone}
              onChange={(e) => handleChange('buyerPhone', e.target.value)}
              placeholder="Ej: 3001234567"
            />

            <div className="courtesy-checkbox">
              <label className="checkbox-label">
                <input
                  type="checkbox"
                  checked={formData.isCourtesy ?? false}
                  onChange={(e) => handleChange('isCourtesy', e.target.checked)}
                />
                <span>Es cortesía (no suma en ingresos, valor $0)</span>
              </label>
            </div>

            {formData.isCourtesy && (
              <div className="courtesy-options">
                <label className="checkbox-label">
                  <input
                    type="checkbox"
                    checked={formData.isGeneralCourtesy ?? false}
                    onChange={(e) => handleChange('isGeneralCourtesy', e.target.checked)}
                  />
                  <span>Cortesía del evento general</span>
                </label>
                {!formData.isGeneralCourtesy && (
                  <CustomInput
                    label="Quien regala la cortesía"
                    type="text"
                    value={formData.giftedBy || ''}
                    onChange={(e) => handleChange('giftedBy', e.target.value)}
                    placeholder="Ej: Patrocinador XYZ"
                  />
                )}
              </div>
            )}

            <CustomInput
              label={
                needsMapZonePick
                  ? `Cantidad (${seatsPerUnit}: celda completa)` 
                  : 'Número de personas (cantidad de tickets) *'
              }
              type="text"
              value={formData.quantity === 0 ? '' : formData.quantity.toString()}
              onChange={(e) => {
                if (needsMapZonePick) return;
                const val = e.target.value.replace(/\D/g, '');
                if (val === '') {
                  handleChange('quantity', 0);
                } else {
                  const numVal = parseInt(val);
                  if (numVal >= 1 && numVal <= 20) {
                    handleChange('quantity', numVal);
                  }
                }
              }}
              onBlur={(e) => {
                if (needsMapZonePick) return;
                if (e.target.value === '' || parseInt(e.target.value) < 1) {
                  handleChange('quantity', 1);
                }
              }}
              pattern="[1-9]|1[0-9]|20"
              required
              disableArrows
              disabled={needsMapZonePick}
            />
            {needsMapZonePick && (
              <p className="helper-text" style={{ marginTop: '-0.5rem', marginBottom: '0.75rem' }}>
                Elige la mesa o palco en el mapa; ocupa la celda entera ({seatsPerUnit}{' '}
                {seatsPerUnit === 1 ? 'entrada' : 'personas'}), como en la tienda.
              </p>
            )}

            <div className="total-section">
              <p className="total-label">{formData.isCourtesy ? 'Total (cortesía):' : 'Total a registrar:'}</p>
              <p className="total-amount">
                {formData.isCourtesy ? '$0 COP' : `$${totalAmount.toLocaleString('es-CO')} COP`}
              </p>
              {qrCountInEmail > 1 && (
                <p className="total-note">Se enviará 1 correo con {qrCountInEmail} QRs en un mismo PDF</p>
              )}
            </div>

            {error && (
              <div className="error-message">
                ⚠️ {error}
              </div>
            )}

            <div className="modal-actions">
              <SecondaryButton 
                onClick={handleCancel} 
                type="button"
                disabled={isSubmitting}
              >
                Cancelar
              </SecondaryButton>
              <PrimaryButton
                type="submit"
                disabled={
                  isSubmitting ||
                  (needsMapZonePick &&
                    (availLoadFailed ||
                      mapAvailLoading ||
                      mapZoneOccupancy === null ||
                      !availableSectionZones.length))
                }
              >
                {isSubmitting ? 'Creando...' : 'Crear Ticket'}
              </PrimaryButton>
            </div>
          </form>
        </div>

        <BulkUploadCortesiasModal
          isOpen={isBulkUploadOpen}
          onClose={() => setIsBulkUploadOpen(false)}
          onSuccess={() => {}}
          onSuccessClose={() => {
            setIsBulkUploadOpen(false);
            onClose();
          }}
          eventId={event.id || ''}
          eventName={event.name || ''}
        />
      </div>
    </div>
  );
};

export default CreateTicketModal;

