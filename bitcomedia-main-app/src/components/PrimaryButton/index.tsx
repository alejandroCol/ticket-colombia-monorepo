import React from 'react';
import './index.scss';
import type { CustomStyleProps } from '../types';
import { generateCustomStyles, generateClassName } from '../types';

interface PrimaryButtonProps extends CustomStyleProps {
  children: React.ReactNode;
  type?: 'button' | 'submit' | 'reset';
  onClick?: (e: React.MouseEvent<HTMLButtonElement>) => void;
  disabled?: boolean;
  fullWidth?: boolean;
  size?: 'small' | 'medium' | 'large';
  icon?: React.ReactNode;
  iconPosition?: 'left' | 'right';
  loading?: boolean;
  form?: string;
  ariaLabel?: string;
  /** Enable grunge text effects for teatro911 theme */
  grungeEffect?: boolean;
  /** Enable pulse animation */
  animated?: boolean;
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
  theme = 'default',
  style,
  cssVariables,
  grungeEffect = false,
  animated = false,
}) => {
  const customStyles = generateCustomStyles(theme, cssVariables, style);
  const componentClassName = generateClassName(
    `primary-button themeable-component ${size} ${fullWidth ? 'full-width' : ''} ${
      loading ? 'loading' : ''
    } ${icon ? `with-icon icon-${iconPosition}` : ''} ${
      grungeEffect && theme === 'teatro911' ? 'with-text-shadow with-grunge-border' : ''
    } ${animated ? 'animated-pulse' : ''}`,
    theme,
    className
  );

  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled || loading}
      className={componentClassName}
      style={customStyles}
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
