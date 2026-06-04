import React, { useState } from 'react';
import type { FormEvent } from 'react';
import { Link } from 'react-router-dom';
import TopNavBar from '../../containers/TopNavBar';
import CustomInput from '../../components/CustomInput';
import CustomSelector from '../../components/CustomSelector';
import PrimaryButton from '../../components/PrimaryButton';
import SecondaryButton from '../../components/SecondaryButton';
import { submitOrganizerInquiry } from '../../services/organizerInquiryService';
import {
  buildGuestPhoneE164,
  DEFAULT_GUEST_PHONE_PREFIX,
  GUEST_PHONE_PREFIX_OPTIONS,
  guestPhoneValidationError,
  isValidGuestPhone,
} from '../../utils/checkoutGuestFields';
import { COLOMBIA_EVENT_AREA_OPTIONS } from '../../utils/colombiaEventAreaCodes';
import { ORGANIZER_ATTENDANCE_OPTIONS } from '../../utils/organizerInquiryAttendance';
import logo from '../../assets/logo.png';
import './index.scss';

type FormErrors = Partial<Record<
  'name' | 'email' | 'whatsapp' | 'eventAreaCode' | 'approximateAttendees' | 'submit',
  string
>>;

const OrganizerInquiryScreen: React.FC = () => {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [whatsappDial, setWhatsappDial] = useState(DEFAULT_GUEST_PHONE_PREFIX);
  const [whatsappLocal, setWhatsappLocal] = useState('');
  const [eventAreaCode, setEventAreaCode] = useState('');
  const [approximateAttendees, setApproximateAttendees] = useState('');
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [errors, setErrors] = useState<FormErrors>({});

  const validate = (): boolean => {
    const next: FormErrors = {};
    let ok = true;

    if (name.trim().length < 2) {
      next.name = 'Ingresa tu nombre completo.';
      ok = false;
    }

    if (!email.trim() || !/\S+@\S+\.\S+/.test(email.trim())) {
      next.email = 'Ingresa un correo válido.';
      ok = false;
    }

    if (!isValidGuestPhone(whatsappDial, whatsappLocal)) {
      next.whatsapp = guestPhoneValidationError(whatsappDial, whatsappLocal);
      ok = false;
    }

    if (!eventAreaCode) {
      next.eventAreaCode = 'Selecciona la ciudad o código de área del evento.';
      ok = false;
    }

    if (!approximateAttendees) {
      next.approximateAttendees = 'Indica cuántas personas esperas aproximadamente.';
      ok = false;
    }

    setErrors(next);
    return ok;
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!validate()) return;

    setLoading(true);
    setErrors({});

    try {
      await submitOrganizerInquiry({
        name: name.trim(),
        email: email.trim(),
        whatsappDial,
        whatsappLocal,
        eventAreaCode,
        approximateAttendees,
      });
      setSubmitted(true);
    } catch (err) {
      const message =
        err instanceof Error
          ? err.message
          : 'No pudimos enviar tu solicitud. Intenta de nuevo.';
      setErrors({ submit: message });
    } finally {
      setLoading(false);
    }
  };

  if (submitted) {
    return (
      <div className="organizer-inquiry">
        <TopNavBar logoOnly />
        <main className="organizer-inquiry__main">
          <div className="organizer-inquiry__card organizer-inquiry__card--success">
            <div className="organizer-inquiry__success-icon" aria-hidden>
              ✓
            </div>
            <h1>¡Gracias, {name.trim().split(' ')[0] || 'organizador'}!</h1>
            <p>
              Recibimos tu solicitud. Nuestro equipo te contactará pronto al correo{' '}
              <strong>{email.trim()}</strong> o por WhatsApp.
            </p>
            <Link to="/" className="organizer-inquiry__back-link">
              <SecondaryButton fullWidth>Volver a eventos</SecondaryButton>
            </Link>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="organizer-inquiry">
      <TopNavBar logoOnly />
      <main className="organizer-inquiry__main">
        <div className="organizer-inquiry__hero">
          <img src={logo} alt="Ticket Colombia" className="organizer-inquiry__logo" />
          <p className="organizer-inquiry__eyebrow">Para organizadores</p>
          <h1>Solicita información</h1>
          <p className="organizer-inquiry__lead">
            Cuéntanos sobre tu evento y te ayudamos con taquilla digital, mapas de butacas y cobro
            en línea.
          </p>
        </div>

        <form className="organizer-inquiry__card" onSubmit={handleSubmit} noValidate>
          {errors.submit && (
            <p className="organizer-inquiry__form-error" role="alert">
              {errors.submit}
            </p>
          )}

          <CustomInput
            name="organizer-name"
            type="text"
            label="Nombre completo"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Ej. María García"
            required
            autoComplete="name"
            error={errors.name}
          />

          <CustomInput
            name="organizer-email"
            type="email"
            label="Correo electrónico"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="tu@correo.com"
            required
            autoComplete="email"
            error={errors.email}
          />

          <div className="organizer-inquiry__phone">
            <span className="organizer-inquiry__phone-label">
              WhatsApp<span className="required-mark">*</span>
            </span>
            <div className="organizer-inquiry__phone-row">
              <select
                className="organizer-inquiry__dial-select"
                aria-label="Indicativo de país"
                value={whatsappDial}
                onChange={(e) => setWhatsappDial(e.target.value)}
              >
                {GUEST_PHONE_PREFIX_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {`${opt.flag}  ${opt.value}`}
                  </option>
                ))}
              </select>
              <input
                type="tel"
                className="organizer-inquiry__phone-input"
                inputMode="numeric"
                autoComplete="tel-national"
                placeholder={whatsappDial === '+57' ? '300 123 4567' : 'Número local'}
                value={whatsappLocal}
                onChange={(e) => setWhatsappLocal(e.target.value)}
                aria-label="Número de WhatsApp"
              />
            </div>
            {errors.whatsapp && (
              <p className="organizer-inquiry__field-error">{errors.whatsapp}</p>
            )}
            <p className="organizer-inquiry__phone-hint">
              Te escribiremos a{' '}
              <span className="organizer-inquiry__phone-preview">
                {whatsappLocal.trim()
                  ? buildGuestPhoneE164(whatsappDial, whatsappLocal)
                  : `${whatsappDial}…`}
              </span>
            </p>
          </div>

          <CustomSelector
            name="event-area"
            label="Ciudad / código de área del evento"
            value={eventAreaCode}
            onChange={(e) => setEventAreaCode(e.target.value)}
            options={COLOMBIA_EVENT_AREA_OPTIONS.map((o) => ({
              value: o.value,
              label: o.label,
            }))}
            placeholder="Selecciona una opción"
            required
            error={errors.eventAreaCode}
          />

          <CustomSelector
            name="attendees"
            label="Personas aproximadas en el evento"
            value={approximateAttendees}
            onChange={(e) => setApproximateAttendees(e.target.value)}
            options={ORGANIZER_ATTENDANCE_OPTIONS.map((o) => ({
              value: o.value,
              label: o.label,
            }))}
            placeholder="Selecciona un rango"
            required
            error={errors.approximateAttendees}
          />

          <PrimaryButton type="submit" fullWidth size="large" loading={loading}>
            Enviar solicitud
          </PrimaryButton>

          <p className="organizer-inquiry__privacy">
            Al enviar, aceptas que te contactemos con información sobre Ticket Colombia. No
            compartimos tus datos con terceros.
          </p>
        </form>

        <Link to="/" className="organizer-inquiry__back-text">
          ← Volver al inicio
        </Link>
      </main>
    </div>
  );
};

export default OrganizerInquiryScreen;
