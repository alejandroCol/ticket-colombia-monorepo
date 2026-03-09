import React from 'react';
import './index.scss';

export interface ChipProps {
  label: string;
  onClick?: () => void;
  active?: boolean;
  disabled?: boolean;
  className?: string;
  icon?: React.ReactNode;
  color?: 'default' | 'primary' | 'accent' | 'success' | 'warning' | 'error';
  size?: 'small' | 'medium' | 'large';
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
}) => {
  const handleClick = () => {
    if (!disabled && onClick) {
      onClick();
    }
  };

  return (
    <div 
      className={`
        chip 
        ${active ? 'active' : ''} 
        ${disabled ? 'disabled' : ''} 
        ${onClick ? 'clickable' : ''} 
        ${`chip-${color}`} 
        ${`chip-${size}`} 
        ${className}
      `}
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
