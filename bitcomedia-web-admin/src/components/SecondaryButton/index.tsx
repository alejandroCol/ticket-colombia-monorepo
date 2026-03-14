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
  icon?: React.ReactNode;
  iconPosition?: 'left' | 'right';
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
  icon,
  iconPosition = 'left',
}) => {
  const buttonClass = `
    secondary-button
    ${size}
    ${fullWidth ? 'full-width' : ''}
    ${loading ? 'loading' : ''}
    ${icon ? `with-icon icon-${iconPosition}` : ''}
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
      {icon && iconPosition === 'left' && !loading && (
        <span className="button-icon left">{icon}</span>
      )}
      <span className="button-text">{children}</span>
      {icon && iconPosition === 'right' && !loading && (
        <span className="button-icon right">{icon}</span>
      )}
    </button>
  );
};

export default SecondaryButton; 