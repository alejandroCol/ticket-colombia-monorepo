import React from 'react';
import './index.scss';
import type { CustomStyleProps } from '../types';
import { generateCustomStyles, generateClassName } from '../types';

export interface ChipProps extends CustomStyleProps {
  label: string;
  onClick?: () => void;
  active?: boolean;
  disabled?: boolean;
  icon?: React.ReactNode;
  color?: 'default' | 'primary' | 'accent' | 'success' | 'warning' | 'error';
  size?: 'small' | 'medium' | 'large';
  /** Enable grunge effects for teatro911 theme */
  grungeEffect?: boolean;
  /** Enable pulse animation */
  animated?: boolean;
}

const Chip: React.FC<ChipProps> = ({
  label,
  onClick,
  active = false,
  disabled = false,
  className = '',
  icon,
  color = 'default',
  size = 'medium',
  theme = 'default',
  style,
  cssVariables,
  grungeEffect = false,
  animated = false,
}) => {
  const handleClick = () => {
    if (!disabled && onClick) {
      onClick();
    }
  };

  const customStyles = generateCustomStyles(theme, cssVariables, style);
  const chipClassName = generateClassName(
    `chip themeable-component ${active ? 'active' : ''} ${disabled ? 'disabled' : ''} ${
      onClick ? 'clickable' : ''
    } chip-${color} chip-${size} ${
      grungeEffect && theme === 'teatro911' ? 'with-text-shadow with-grunge-border' : ''
    } ${animated ? 'animated-pulse' : ''}`,
    theme,
    className
  );

  return (
    <div 
      className={chipClassName}
      style={customStyles}
      onClick={handleClick}
      role={onClick ? 'button' : undefined}
      tabIndex={onClick && !disabled ? 0 : undefined}
    >
      {icon && <span className="chip-icon">{icon}</span>}
      <span className="chip-label">{label}</span>
    </div>
  );
};

export default Chip;
