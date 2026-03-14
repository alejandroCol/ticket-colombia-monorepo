import React from 'react';

const iconColor = 'currentColor';

/** Icono Crear - ticket con signo más */
export const IconCreate: React.FC<{ className?: string; size?: number }> = ({ className, size = 20 }) => (
  <svg className={className} width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={iconColor} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="5" width="7" height="14" rx="1.5" />
    <rect x="14" y="5" width="7" height="14" rx="1.5" />
    <path d="M10 5v14" strokeDasharray="2 2" />
    <path d="M16 12h3M17.5 10.5v3" />
  </svg>
);

/** Icono Ver Boletos - lista de tickets */
export const IconViewTickets: React.FC<{ className?: string; size?: number }> = ({ className, size = 20 }) => (
  <svg className={className} width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={iconColor} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="2" y="4" width="20" height="16" rx="2" />
    <path d="M2 10h20" />
    <path d="M2 14h20" />
    <path d="M6 7v2M6 11v2M6 15v2" />
  </svg>
);

/** Icono Estadísticas - gráfico de barras */
export const IconStats: React.FC<{ className?: string; size?: number }> = ({ className, size = 20 }) => (
  <svg className={className} width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={iconColor} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="2" y="2" width="20" height="20" rx="2" />
    <path d="M7 18V12M12 18V8M17 18V14" />
  </svg>
);

/** Icono Editar - lápiz */
export const IconEdit: React.FC<{ className?: string; size?: number }> = ({ className, size = 20 }) => (
  <svg className={className} width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={iconColor} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
    <path d="M18.5 2.5a2.12 2.12 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
  </svg>
);
