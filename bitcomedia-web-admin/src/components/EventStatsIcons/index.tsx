import React from 'react';

const iconColor = 'currentColor';

/** Icono de boletas/tickets - diseño Ticket Colombia */
export const IconTickets: React.FC<{ className?: string }> = ({ className }) => (
  <svg className={className} viewBox="0 0 48 48" fill="none" stroke={iconColor} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="6" y="10" width="14" height="22" rx="2" />
    <rect x="28" y="10" width="14" height="22" rx="2" />
    <path d="M10 18h6M10 24h6M10 30h6" />
    <path d="M32 18h4M32 24h4M32 30h4" />
    <path d="M20 10v28" strokeDasharray="2 2" />
  </svg>
);

/** Icono de ingresos - flecha ascendente con moneda */
export const IconRevenue: React.FC<{ className?: string }> = ({ className }) => (
  <svg className={className} viewBox="0 0 48 48" fill="none" stroke={iconColor} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M24 8v32M14 18l10-10 10 10" />
    <path d="M10 38h28" />
    <circle cx="24" cy="6" r="2" fill={iconColor} />
  </svg>
);

/** Icono de compradores - grupo de personas */
export const IconUsers: React.FC<{ className?: string }> = ({ className }) => (
  <svg className={className} viewBox="0 0 48 48" fill="none" stroke={iconColor} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="16" cy="14" r="5" />
    <circle cx="32" cy="14" r="5" />
    <path d="M8 38c0-6 3.5-10 8-10s8 4 8 10" />
    <path d="M32 38c0-6 3.5-10 8-10s8 4 8 10" />
    <path d="M24 24c3 0 6 2 6 6" />
  </svg>
);

/** Icono de gráfico - barras */
export const IconChart: React.FC<{ className?: string }> = ({ className }) => (
  <svg className={className} viewBox="0 0 48 48" fill="none" stroke={iconColor} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="4" y="4" width="40" height="40" rx="4" />
    <path d="M14 34V22M24 34V14M34 34V18" />
  </svg>
);

/** Icono de egresos - signo menos / salida */
export const IconExpense: React.FC<{ className?: string }> = ({ className }) => (
  <svg className={className} viewBox="0 0 48 48" fill="none" stroke={iconColor} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="24" cy="24" r="16" />
    <path d="M16 24h16" />
  </svg>
);

/** Icono de utilidad - tendencia al alza */
export const IconProfit: React.FC<{ className?: string }> = ({ className }) => (
  <svg className={className} viewBox="0 0 48 48" fill="none" stroke={iconColor} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M8 36L18 24 28 28 40 12" />
    <path d="M8 36h32" />
    <circle cx="40" cy="12" r="2" fill={iconColor} />
  </svg>
);

/** Icono de secciones/tribunas */
export const IconSection: React.FC<{ className?: string }> = ({ className }) => (
  <svg className={className} viewBox="0 0 48 48" fill="none" stroke={iconColor} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="4" y="6" width="40" height="36" rx="2" />
    <path d="M4 18h40M4 30h40" />
    <path d="M16 6v36M32 6v36" />
  </svg>
);

/** Icono de evento en calendario */
export const IconCalendarEvent: React.FC<{ className?: string }> = ({ className }) => (
  <svg className={className} viewBox="0 0 48 48" fill="none" stroke={iconColor} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="8" y="12" width="32" height="28" rx="3" />
    <path d="M8 20h32" />
    <path d="M18 8v6M30 8v6" />
    <path d="M18 28h6v6h-6z" fill={iconColor} stroke="none" />
    <path d="M28 28h4M28 32h4" />
  </svg>
);
