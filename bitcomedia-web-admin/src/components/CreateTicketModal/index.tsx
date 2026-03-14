import React, { useState } from 'react';
import CustomInput from '@components/CustomInput';
import CustomSelector from '@components/CustomSelector';
import PrimaryButton from '@components/PrimaryButton';
import SecondaryButton from '@components/SecondaryButton';
import Loader from '@components/Loader';
import BulkUploadCortesiasModal from '@components/BulkUploadCortesiasModal';
import type { Event } from '@services/types';
import './index.scss';

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
    isCourtesy: false,
    isGeneralCourtesy: false,
    giftedBy: ''
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isBulkUploadOpen, setIsBulkUploadOpen] = useState(false);
  
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
    // Validar formato de email
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(formData.buyerEmail)) {
      setError('El correo electrónico no es válido');
      return false;
    }
    if (formData.quantity < 1 || formData.quantity > 10) {
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
      isCourtesy: false,
      isGeneralCourtesy: false,
      giftedBy: ''
    });
    setError(null);
    onClose();
  };

  const handleSectionChange = (sectionId: string) => {
    const selectedSection = event.sections?.find(s => s.id === sectionId);
    setFormData({
      ...formData,
      sectionId: sectionId || undefined,
      sectionName: selectedSection?.name || undefined
    });
  };

  if (!isOpen) return null;

  const ticketPrice = getTicketPrice();
  const totalAmount = ticketPrice * formData.quantity;

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
              label="Número de personas (cantidad de tickets) *"
              type="text"
              value={formData.quantity === 0 ? '' : formData.quantity.toString()}
              onChange={(e) => {
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
                if (e.target.value === '' || parseInt(e.target.value) < 1) {
                  handleChange('quantity', 1);
                }
              }}
              pattern="[1-9]|1[0-9]|20"
              required
              disableArrows
            />

            <div className="total-section">
              <p className="total-label">{formData.isCourtesy ? 'Total (cortesía):' : 'Total a registrar:'}</p>
              <p className="total-amount">
                {formData.isCourtesy ? '$0 COP' : `$${totalAmount.toLocaleString('es-CO')} COP`}
              </p>
              {formData.quantity > 1 && (
                <p className="total-note">Se enviará 1 correo con {formData.quantity} QRs en un mismo PDF</p>
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
                disabled={isSubmitting}
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

