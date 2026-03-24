import React from "react";

const accent = "#CCA88F";

type IconProps = { className?: string; title?: string };

/** Calendario — marca Ticket Colombia */
export const IconCheckoutCalendar: React.FC<IconProps> = ({
  className = "",
  title = "Fecha",
}) => (
  <svg
    className={className}
    width={20}
    height={20}
    viewBox="0 0 24 24"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    aria-hidden={title ? undefined : true}
    role={title ? "img" : undefined}
    aria-label={title}
  >
    <rect x="3" y="5" width="18" height="16" rx="3" stroke={accent} strokeWidth="1.6" />
    <path d="M3 10h18" stroke={accent} strokeWidth="1.6" strokeLinecap="round" />
    <path d="M8 3v4M16 3v4" stroke={accent} strokeWidth="1.6" strokeLinecap="round" />
    <circle cx="9" cy="14.5" r="1.2" fill={accent} />
    <circle cx="12" cy="14.5" r="1.2" fill={accent} />
    <circle cx="15" cy="14.5" r="1.2" fill={accent} />
  </svg>
);

/** Ubicación */
export const IconCheckoutLocation: React.FC<IconProps> = ({
  className = "",
  title = "Ubicación",
}) => (
  <svg
    className={className}
    width={20}
    height={20}
    viewBox="0 0 24 24"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    aria-hidden={title ? undefined : true}
    role={title ? "img" : undefined}
    aria-label={title}
  >
    <path
      d="M12 21s7-5.2 7-11a7 7 0 1 0-14 0c0 5.8 7 11 7 11z"
      stroke={accent}
      strokeWidth="1.6"
      strokeLinejoin="round"
    />
    <circle cx="12" cy="10" r="2.4" stroke={accent} strokeWidth="1.6" />
  </svg>
);

/** Temporizador — reserva de cupo */
export const IconCheckoutTimer: React.FC<IconProps> = ({
  className = "",
  title = "Tiempo restante",
}) => (
  <svg
    className={className}
    width={22}
    height={22}
    viewBox="0 0 24 24"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    aria-hidden={title ? undefined : true}
    role={title ? "img" : undefined}
    aria-label={title}
  >
    <circle cx="12" cy="12" r="9" stroke={accent} strokeWidth="1.6" />
    <path
      d="M12 7v5l3 2"
      stroke={accent}
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

/** Pago en línea — tarjeta estilizada */
export const IconCheckoutPayOnline: React.FC<IconProps> = ({
  className = "",
  title = "Pagar en línea",
}) => (
  <svg
    className={className}
    width={22}
    height={22}
    viewBox="0 0 24 24"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    aria-hidden={title ? undefined : true}
    role={title ? "img" : undefined}
    aria-label={title}
  >
    <rect x="2.5" y="5" width="19" height="14" rx="2.5" stroke={accent} strokeWidth="1.5" />
    <path d="M2.5 9.5h19" stroke={accent} strokeWidth="1.5" />
    <rect x="5" y="13" width="5" height="2.2" rx="0.6" fill={accent} opacity={0.85} />
    <path d="M13 14h6" stroke={accent} strokeWidth="1.2" strokeLinecap="round" opacity={0.7} />
  </svg>
);

/** Información / tarifa de servicio */
export const IconCheckoutInfo: React.FC<IconProps> = ({
  className = "",
  title = "Información",
}) => (
  <svg
    className={className}
    width={18}
    height={18}
    viewBox="0 0 24 24"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    aria-hidden={title ? undefined : true}
    role={title ? "img" : undefined}
    aria-label={title}
  >
    <circle cx="12" cy="12" r="9" stroke={accent} strokeWidth="1.5" />
    <path
      d="M12 10.2V17M12 7.3v.05"
      stroke={accent}
      strokeWidth="1.8"
      strokeLinecap="round"
    />
  </svg>
);
