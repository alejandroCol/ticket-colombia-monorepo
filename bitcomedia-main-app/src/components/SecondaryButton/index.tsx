import React from 'react';
import './index.scss';
import type { CustomStyleProps } from '../types';
import { generateCustomStyles, generateClassName } from '../types';

interface SecondaryButtonProps extends CustomStyleProps {
  children: React.ReactNode;
  onClick?: () => void;
  type?: 'button' | 'submit' | 'reset';
  disabled?: boolean;
  fullWidth?: boolean;
  size?: 'small' | 'medium' | 'large';
  loading?: boolean;
  /** Enable grunge text effects for teatro911 theme */
  grungeEffect?: boolean;
  /** Enable pulse animation */
  animated?: boolean;
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
  theme = 'default',
  style,
  cssVariables,
  grungeEffect = false,
  animated = false,
}) => {
  const customStyles = generateCustomStyles(theme, cssVariables, style);
  const buttonClass = generateClassName(
    `secondary-button themeable-component ${size} ${fullWidth ? 'full-width' : ''} ${
      loading ? 'loading' : ''
    } ${grungeEffect && theme === 'teatro911' ? 'with-text-shadow with-grunge-border' : ''} ${
      animated ? 'animated-pulse' : ''
    }`,
    theme,
    className
  );

  return (
    <button
      type={type}
      className={buttonClass}
      style={customStyles}
      onClick={onClick}
      disabled={disabled || loading}
    >
      {loading && <div className="loading-spinner" />}
      <span className="button-text">{children}</span>
    </button>
  );
};

export default SecondaryButton; 