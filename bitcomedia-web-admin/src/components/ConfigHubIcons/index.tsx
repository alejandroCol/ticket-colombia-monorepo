import React from 'react';

const c = 'currentColor';

/** Estilo común con IconScanIcons / EventCardIcons (Ticket Colombia) */
export const IconHubContact: React.FC<{ className?: string; size?: number }> = ({ className, size = 18 }) => (
  <svg className={className} width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z" />
  </svg>
);

export const IconHubBolt: React.FC<{ className?: string; size?: number }> = ({ className, size = 18 }) => (
  <svg className={className} width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" />
  </svg>
);

export const IconHubImage: React.FC<{ className?: string; size?: number }> = ({ className, size = 22 }) => (
  <svg className={className} width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
    <circle cx="8.5" cy="8.5" r="1.5" />
    <path d="M21 15l-5-5L5 21" />
  </svg>
);

export const IconHubWallet: React.FC<{ className?: string; size?: number }> = ({ className, size = 22 }) => (
  <svg className={className} width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    <path d="M21 12V7H5a2 2 0 0 1 0-4h14v4" />
    <path d="M3 5v14a2 2 0 0 0 2 2h16v-5" />
    <path d="M18 12a2 2 0 0 0 0 4h4v-4h-4z" />
  </svg>
);

export const IconHubSpark: React.FC<{ className?: string; size?: number }> = ({ className, size = 18 }) => (
  <svg className={className} width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" />
    <circle cx="12" cy="12" r="3" />
  </svg>
);

export const IconHubHandshake: React.FC<{ className?: string; size?: number }> = ({ className, size = 22 }) => (
  <svg className={className} width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    <path d="M11 14h2a2 2 0 0 0 2-2v-2a2 2 0 0 0-2-2h-2" />
    <path d="M4 9.5V8a2 2 0 0 1 2-2h3l4 4v3a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2v-1.5" />
    <path d="M20 9.5V8a2 2 0 0 0-2-2h-2l-3 3v4l2 2h3a2 2 0 0 0 2-2v-1.5" />
  </svg>
);

export const IconHubUsers: React.FC<{ className?: string; size?: number }> = ({ className, size = 18 }) => (
  <svg className={className} width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
    <circle cx="9" cy="7" r="4" />
    <path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" />
  </svg>
);

export const IconHubClipboard: React.FC<{ className?: string; size?: number }> = ({ className, size = 18 }) => (
  <svg className={className} width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    <path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2" />
    <rect x="8" y="2" width="8" height="4" rx="1" ry="1" />
    <path d="M9 12h6M9 16h6" />
  </svg>
);

export const IconHubChevronRight: React.FC<{ className?: string; size?: number }> = ({ className, size = 18 }) => (
  <svg className={className} width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    <path d="M9 18l6-6-6-6" />
  </svg>
);

export const IconHubUserPlus: React.FC<{ className?: string; size?: number }> = ({ className, size = 18 }) => (
  <svg className={className} width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    <path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
    <circle cx="8.5" cy="7" r="4" />
    <path d="M20 8v6M23 11h-6" />
  </svg>
);
