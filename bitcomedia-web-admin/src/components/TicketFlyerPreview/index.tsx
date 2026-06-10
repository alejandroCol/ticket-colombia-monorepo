import React from 'react';
import DummyQrCode from './DummyQrCode';
import './index.scss';

export type TicketFlyerPreviewLayout = 'standard' | 'minimal_center';

export interface TicketFlyerPreviewProps {
  backgroundImageUrl: string;
  layout: TicketFlyerPreviewLayout;
  accentColor: string;
  minimalNameColor: string;
  minimalEmailColor: string;
  eventName?: string;
  eventDateLabel?: string;
  venueName?: string;
  city?: string;
  sectionName?: string;
  ticketPriceLabel?: string;
}

const DUMMY = {
  buyerName: 'María García',
  buyerEmail: 'comprador@ejemplo.com',
  buyerId: '1.234.567.890',
  ticketId: 'TC-ABC123-DEMO',
  eventName: 'Nombre del evento',
  eventDate: '15 de junio de 2026 - 8:00 p. m.',
  venue: 'Teatro Municipal',
  city: 'Bogotá',
  section: 'VIP',
  price: '$85.000',
} as const;

function StandardFlyerContent({
  accentColor,
  eventName,
  eventDateLabel,
  venueName,
  city,
  sectionName,
  ticketPriceLabel,
}: Pick<
  TicketFlyerPreviewProps,
  'accentColor' | 'eventName' | 'eventDateLabel' | 'venueName' | 'city' | 'sectionName' | 'ticketPriceLabel'
>) {
  const locality = sectionName?.trim() || DUMMY.section;

  return (
    <>
      <header className="ticket-flyer-preview__header">
        <p className="ticket-flyer-preview__brand">TICKET COLOMBIA</p>
        <p className="ticket-flyer-preview__event-name">{eventName?.trim() || DUMMY.eventName}</p>
        <p className="ticket-flyer-preview__meta">{eventDateLabel || DUMMY.eventDate}</p>
        <p className="ticket-flyer-preview__meta ticket-flyer-preview__meta--muted">
          {venueName?.trim() || DUMMY.venue}
        </p>
        <p className="ticket-flyer-preview__meta ticket-flyer-preview__meta--muted">
          {city?.trim() || DUMMY.city}
        </p>
        <p className="ticket-flyer-preview__locality" style={{ color: accentColor }}>
          {locality}
        </p>
      </header>

      <hr className="ticket-flyer-preview__divider" />

      <section className="ticket-flyer-preview__buyer-block">
        <p className="ticket-flyer-preview__section-title">Información del Comprador</p>
        <p className="ticket-flyer-preview__line">Nombre: {DUMMY.buyerName}</p>
        <p className="ticket-flyer-preview__line">Email: {DUMMY.buyerEmail}</p>
        <p className="ticket-flyer-preview__line">Cédula / documento: {DUMMY.buyerId}</p>
      </section>

      <p className="ticket-flyer-preview__ticket-label" style={{ color: accentColor }}>
        Ticket 1 de 1:
      </p>

      <div className="ticket-flyer-preview__qr-panel">
        <DummyQrCode className="ticket-flyer-preview__qr" />
        <div className="ticket-flyer-preview__qr-info">
          <p className="ticket-flyer-preview__line">ID: {DUMMY.ticketId}</p>
          <p className="ticket-flyer-preview__line">Titular: {DUMMY.buyerName}</p>
          <p className="ticket-flyer-preview__line">Email: {DUMMY.buyerEmail}</p>
          <p className="ticket-flyer-preview__line">Cédula / documento: {DUMMY.buyerId}</p>
          <p className="ticket-flyer-preview__accent-line" style={{ color: accentColor }}>
            Localidad: {locality}
          </p>
          <p className="ticket-flyer-preview__accent-line" style={{ color: accentColor }}>
            Valor: {ticketPriceLabel || DUMMY.price}
          </p>
          <p className="ticket-flyer-preview__hint">Presenta este QR en la entrada</p>
        </div>
      </div>

      <footer className="ticket-flyer-preview__footer">
        <p>Este documento contiene 1 ticket(s). Cada ticket es válido para una sola entrada.</p>
        <p className="ticket-flyer-preview__footer-muted">Vista previa · Ticket Colombia</p>
      </footer>
    </>
  );
}

function MinimalFlyerContent({
  accentColor,
  minimalNameColor,
  minimalEmailColor,
  sectionName,
}: Pick<
  TicketFlyerPreviewProps,
  'accentColor' | 'minimalNameColor' | 'minimalEmailColor' | 'sectionName'
>) {
  const locality = sectionName?.trim() || DUMMY.section;

  return (
    <div className="ticket-flyer-preview__minimal-box">
      <DummyQrCode className="ticket-flyer-preview__qr ticket-flyer-preview__qr--minimal" />
      <div className="ticket-flyer-preview__minimal-text">
        <p className="ticket-flyer-preview__minimal-locality" style={{ color: accentColor }}>
          {locality}
        </p>
        <p className="ticket-flyer-preview__minimal-name" style={{ color: minimalNameColor }}>
          {DUMMY.buyerName}
        </p>
        <p className="ticket-flyer-preview__minimal-email" style={{ color: minimalEmailColor }}>
          {DUMMY.buyerEmail}
        </p>
        <p className="ticket-flyer-preview__minimal-caption" style={{ color: minimalEmailColor }}>
          Cédula / documento: {DUMMY.buyerId}
        </p>
        <p className="ticket-flyer-preview__minimal-caption" style={{ color: minimalEmailColor }}>
          Presenta este QR en la entrada
        </p>
        <p className="ticket-flyer-preview__minimal-caption" style={{ color: minimalEmailColor }}>
          Entrada 1 de 2
        </p>
      </div>
    </div>
  );
}

const TicketFlyerPreview: React.FC<TicketFlyerPreviewProps> = ({
  backgroundImageUrl,
  layout,
  accentColor,
  minimalNameColor,
  minimalEmailColor,
  eventName,
  eventDateLabel,
  venueName,
  city,
  sectionName,
  ticketPriceLabel,
}) => (
  <div className="ticket-flyer-preview" aria-label="Vista previa del PDF del boleto">
    <div
      className="ticket-flyer-preview__page"
      style={{ backgroundImage: `url(${backgroundImageUrl})` }}
    >
      {layout === 'minimal_center' ? (
        <MinimalFlyerContent
          accentColor={accentColor}
          minimalNameColor={minimalNameColor}
          minimalEmailColor={minimalEmailColor}
          sectionName={sectionName}
        />
      ) : (
        <StandardFlyerContent
          accentColor={accentColor}
          eventName={eventName}
          eventDateLabel={eventDateLabel}
          venueName={venueName}
          city={city}
          sectionName={sectionName}
          ticketPriceLabel={ticketPriceLabel}
        />
      )}
    </div>
    <p className="ticket-flyer-preview__caption">
      Datos de ejemplo · el PDF real usará la compra confirmada
    </p>
  </div>
);

export default TicketFlyerPreview;
