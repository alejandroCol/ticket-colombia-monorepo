import React from 'react';

const iconColor = 'currentColor';

/** Icono Leer Boletos - ticket con escáner QR (estilo Ticket Colombia) */
export const IconScanTickets: React.FC<{ className?: string; size?: number }> = ({ className, size = 20 }) => (
  <svg className={className} width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={iconColor} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="2" y="4" width="20" height="16" rx="2" />
    <path d="M2 10h20" />
    <rect x="7" y="13" width="7" height="7" rx="1" />
    <path d="M9 15h1M12 15h1M9 17h1M12 17h1" strokeWidth="1.2" />
    <path d="M16 13h2M16 15h2M18 14h1" strokeWidth="1.5" />
    <path d="M6 7v1M18 7v1" />
  </svg>
);

/** Icono Activar Cámara - cámara con lente (estilo Ticket Colombia) */
export const IconCamera: React.FC<{ className?: string; size?: number }> = ({ className, size = 20 }) => (
  <svg className={className} width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={iconColor} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
    <circle cx="12" cy="13" r="4" />
  </svg>
);

/** Icono Pausar - para pausar el escáner */
export const IconPause: React.FC<{ className?: string; size?: number }> = ({ className, size = 20 }) => (
  <svg className={className} width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={iconColor} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="6" y="4" width="4" height="16" rx="1" />
    <rect x="14" y="4" width="4" height="16" rx="1" />
  </svg>
);
