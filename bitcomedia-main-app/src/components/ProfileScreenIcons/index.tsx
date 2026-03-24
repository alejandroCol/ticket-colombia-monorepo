import React from "react";

type IconProps = {
  className?: string;
  size?: number;
  title?: string;
};

const dim = (size: number) => ({ width: size, height: size });

/**
 * Iconos lineales para la pantalla de perfil (Ticket Colombia — acento vía currentColor).
 */
export const ProfileIconArrowBack: React.FC<IconProps> = ({
  className = "",
  size = 22,
  title,
}) => (
  <svg
    className={className}
    style={dim(size)}
    viewBox="0 0 24 24"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    aria-hidden={title ? undefined : true}
    role={title ? "img" : undefined}
    aria-label={title}
  >
    <path
      d="M19 12H5M12 19l-7-7 7-7"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

export const ProfileIconMail: React.FC<IconProps> = ({
  className = "",
  size = 22,
  title,
}) => (
  <svg
    className={className}
    style={dim(size)}
    viewBox="0 0 24 24"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    aria-hidden={title ? undefined : true}
    role={title ? "img" : undefined}
    aria-label={title}
  >
    <path
      d="M4 6.5h16v11H4v-11z"
      stroke="currentColor"
      strokeWidth="1.65"
      strokeLinejoin="round"
    />
    <path
      d="M4 7l8 5.5L20 7"
      stroke="currentColor"
      strokeWidth="1.65"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

export const ProfileIconPhone: React.FC<IconProps> = ({
  className = "",
  size = 22,
  title,
}) => (
  <svg
    className={className}
    style={dim(size)}
    viewBox="0 0 24 24"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    aria-hidden={title ? undefined : true}
    role={title ? "img" : undefined}
    aria-label={title}
  >
    <path
      d="M8.5 3.5h2.2l1.2 4.5-2.1 1.3c.8 1.8 2.3 3.4 4.1 4.2l1.3-2.1 4.5 1.2v2.2c0 .8-.6 1.6-1.4 1.9-2.4 1-5.1.3-7.8-2.4s-3.4-5.4-2.4-7.8c.3-.8 1.1-1.4 1.9-1.4z"
      stroke="currentColor"
      strokeWidth="1.65"
      strokeLinejoin="round"
    />
  </svg>
);

export const ProfileIconLocation: React.FC<IconProps> = ({
  className = "",
  size = 22,
  title,
}) => (
  <svg
    className={className}
    style={dim(size)}
    viewBox="0 0 24 24"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    aria-hidden={title ? undefined : true}
    role={title ? "img" : undefined}
    aria-label={title}
  >
    <path
      d="M12 21s6.5-5.2 6.5-11a6.5 6.5 0 1 0-13 0C5.5 15.8 12 21 12 21z"
      stroke="currentColor"
      strokeWidth="1.65"
      strokeLinejoin="round"
    />
    <circle
      cx="12"
      cy="10"
      r="2.25"
      stroke="currentColor"
      strokeWidth="1.65"
    />
  </svg>
);

export const ProfileIconEdit: React.FC<IconProps> = ({
  className = "",
  size = 22,
  title,
}) => (
  <svg
    className={className}
    style={dim(size)}
    viewBox="0 0 24 24"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    aria-hidden={title ? undefined : true}
    role={title ? "img" : undefined}
    aria-label={title}
  >
    <path
      d="M4 20h4.5l9.9-9.9a2.12 2.12 0 0 0 0-3l-1.6-1.6a2.12 2.12 0 0 0-3 0L4 15.5V20z"
      stroke="currentColor"
      strokeWidth="1.65"
      strokeLinejoin="round"
    />
    <path
      d="M13.5 6.5l4 4"
      stroke="currentColor"
      strokeWidth="1.65"
      strokeLinecap="round"
    />
  </svg>
);

export const ProfileIconKey: React.FC<IconProps> = ({
  className = "",
  size = 22,
  title,
}) => (
  <svg
    className={className}
    style={dim(size)}
    viewBox="0 0 24 24"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    aria-hidden={title ? undefined : true}
    role={title ? "img" : undefined}
    aria-label={title}
  >
    <circle
      cx="8"
      cy="12"
      r="3.25"
      stroke="currentColor"
      strokeWidth="1.65"
    />
    <path
      d="M11.25 12h6.75v3h-2.25v2.25M11.25 12v-1.5"
      stroke="currentColor"
      strokeWidth="1.65"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

export const ProfileIconLogout: React.FC<IconProps> = ({
  className = "",
  size = 22,
  title,
}) => (
  <svg
    className={className}
    style={dim(size)}
    viewBox="0 0 24 24"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    aria-hidden={title ? undefined : true}
    role={title ? "img" : undefined}
    aria-label={title}
  >
    <path
      d="M10 5H5.5A1.5 1.5 0 0 0 4 6.5v11A1.5 1.5 0 0 0 5.5 19H10M15 16l4-4-4-4M19 12H8"
      stroke="currentColor"
      strokeWidth="1.65"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

export const ProfileIconSupport: React.FC<IconProps> = ({
  className = "",
  size = 24,
  title,
}) => (
  <svg
    className={className}
    style={dim(size)}
    viewBox="0 0 24 24"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    aria-hidden={title ? undefined : true}
    role={title ? "img" : undefined}
    aria-label={title}
  >
    <path
      d="M5 10.5a7 7 0 0112.12-4.74A7 7 0 0119 10.5c0 2.5-1.3 4.7-3.3 5.9L14 19v-3.1A7 7 0 015 10.5z"
      stroke="currentColor"
      strokeWidth="1.65"
      strokeLinejoin="round"
    />
    <path
      d="M9.5 9.5h.01M12 9.5h.01M14.5 9.5h.01"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
    />
  </svg>
);

export const ProfileIconChevronRight: React.FC<IconProps> = ({
  className = "",
  size = 20,
  title,
}) => (
  <svg
    className={className}
    style={dim(size)}
    viewBox="0 0 24 24"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    aria-hidden={title ? undefined : true}
    role={title ? "img" : undefined}
    aria-label={title}
  >
    <path
      d="M10 6l6 6-6 6"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

/** Marca de usuario — círculo con silueta minimal */
export const ProfileIconUserBadge: React.FC<IconProps> = ({
  className = "",
  size = 28,
  title,
}) => (
  <svg
    className={className}
    style={dim(size)}
    viewBox="0 0 24 24"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    aria-hidden={title ? undefined : true}
    role={title ? "img" : undefined}
    aria-label={title}
  >
    <circle cx="12" cy="9" r="3.25" stroke="currentColor" strokeWidth="1.65" />
    <path
      d="M6 19.5c0-3.3 2.7-6 6-6s6 2.7 6 6"
      stroke="currentColor"
      strokeWidth="1.65"
      strokeLinecap="round"
    />
  </svg>
);

export const ProfileIconInstagram: React.FC<IconProps> = ({
  className = "",
  size = 22,
  title,
}) => (
  <svg
    className={className}
    style={dim(size)}
    viewBox="0 0 24 24"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    aria-hidden={title ? undefined : true}
    role={title ? "img" : undefined}
    aria-label={title}
  >
    <rect
      x="3.5"
      y="3.5"
      width="17"
      height="17"
      rx="4.5"
      stroke="currentColor"
      strokeWidth="1.65"
    />
    <circle cx="12" cy="12" r="3.75" stroke="currentColor" strokeWidth="1.65" />
    <circle cx="17.25" cy="6.75" r="0.9" fill="currentColor" />
  </svg>
);

export const ProfileIconTikTok: React.FC<IconProps> = ({
  className = "",
  size = 22,
  title,
}) => (
  <svg
    className={className}
    style={dim(size)}
    viewBox="0 0 24 24"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    aria-hidden={title ? undefined : true}
    role={title ? "img" : undefined}
    aria-label={title}
  >
    <path
      d="M14.5 5.5v8.2a3.2 3.2 0 1 1-3.2-3.2c.2 0 .4 0 .6.05V8.1a5.5 5.5 0 0 0 2.6-.75v-1.85z"
      stroke="currentColor"
      strokeWidth="1.65"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <path
      d="M10.9 16.4a2.4 2.4 0 1 0 0-4.8"
      stroke="currentColor"
      strokeWidth="1.2"
      strokeLinecap="round"
      opacity={0.45}
    />
  </svg>
);

/** Entrada / ticket — perforaciones */
export const ProfileIconTicket: React.FC<IconProps> = ({
  className = "",
  size = 26,
  title,
}) => (
  <svg
    className={className}
    style={dim(size)}
    viewBox="0 0 24 24"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    aria-hidden={title ? undefined : true}
    role={title ? "img" : undefined}
    aria-label={title}
  >
    <path
      d="M4.5 8.5c0-1.1.9-2 2-2h11a2 2 0 0 1 2 2v1.2a1.8 1.8 0 1 0 0 3.6V14a2 2 0 0 1-2 2h-11a2 2 0 0 1-2-2v-1.2a1.8 1.8 0 1 0 0-3.6V8.5z"
      stroke="currentColor"
      strokeWidth="1.65"
      strokeLinejoin="round"
    />
    <path
      d="M9.5 8v8M14.5 8v8"
      stroke="currentColor"
      strokeWidth="1.2"
      strokeLinecap="round"
      opacity={0.35}
    />
  </svg>
);

export const ProfileIconSparkle: React.FC<IconProps> = ({
  className = "",
  size = 26,
  title,
}) => (
  <svg
    className={className}
    style={dim(size)}
    viewBox="0 0 24 24"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    aria-hidden={title ? undefined : true}
    role={title ? "img" : undefined}
    aria-label={title}
  >
    <path
      d="M12 3l1.2 4.2L17.4 9l-4.2 1.2L12 14.4 10.8 10.2 6.6 9l4.2-1.2L12 3zM18 15l.6 2.1 2.1.6-2.1.6L18 20.4l-.6-2.1-2.1-.6 2.1-.6L18 15z"
      stroke="currentColor"
      strokeWidth="1.4"
      strokeLinejoin="round"
    />
  </svg>
);
