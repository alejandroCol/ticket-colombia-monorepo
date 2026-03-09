import React from 'react';
import './index.scss';

interface SecondaryButtonProps {
  children: React.ReactNode;
  onClick?: (e: React.MouseEvent<HTMLButtonElement>) => void;
  type?: 'button' | 'submit' | 'reset';
  disabled?: boolean;
  fullWidth?: boolean;
  size?: 'small' | 'medium' | 'large';
  className?: string;
  loading?: boolean;
}

const SecondaryButton: React.FC<SecondaryButtonProps> = ({
  children,
  onClick,
  type = 'button',
  disabled = false,
  fullWidth = false,
  size = 'medium',
  className = '',
  loading = false,
}) => {
  const buttonClass = `
    secondary-button
    ${size}
    ${fullWidth ? 'full-width' : ''}
    ${loading ? 'loading' : ''}
    ${className}
  `.trim();

  return (
    <button
      type={type}
      className={buttonClass}
      onClick={onClick}
      disabled={disabled || loading}
    >
      {loading && <div className="loading-spinner" />}
      <span className="button-text">{children}</span>
    </button>
  );
};

export default SecondaryButton; 