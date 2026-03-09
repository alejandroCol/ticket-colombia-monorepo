import React from 'react';
import './index.scss';

interface PrimaryButtonProps {
  children: React.ReactNode;
  type?: 'button' | 'submit' | 'reset';
  onClick?: (e: React.MouseEvent<HTMLButtonElement>) => void;
  disabled?: boolean;
  className?: string;
  fullWidth?: boolean;
  size?: 'small' | 'medium' | 'large';
  icon?: React.ReactNode;
  iconPosition?: 'left' | 'right';
  loading?: boolean;
  form?: string;
  ariaLabel?: string;
}

const PrimaryButton: React.FC<PrimaryButtonProps> = ({
  children,
  type = 'button',
  onClick,
  disabled = false,
  className = '',
  fullWidth = false,
  size = 'medium',
  icon,
  iconPosition = 'left',
  loading = false,
  form,
  ariaLabel,
}) => {
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled || loading}
      className={`primary-button ${size} ${fullWidth ? 'full-width' : ''} ${className} ${
        loading ? 'loading' : ''
      } ${icon ? `with-icon icon-${iconPosition}` : ''}`}
      form={form}
      aria-label={ariaLabel}
    >
      {loading && (
        <span className="loading-spinner"></span>
      )}
      
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

export default PrimaryButton;
