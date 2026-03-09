import React from 'react';
import './index.scss';
import type { CustomStyleProps } from '../types';
import { generateCustomStyles, generateClassName } from '../types';

interface LoaderProps extends CustomStyleProps {
  size?: 'small' | 'medium' | 'large';
  color?: 'primary' | 'secondary' | 'accent';
  fullScreen?: boolean;
  /** Enable grunge effects for teatro911 theme */
  grungeEffect?: boolean;
  /** Enable alternative theater911 animations */
  theatricalAnimation?: boolean;
}

const Loader: React.FC<LoaderProps> = ({ 
  size = 'medium', 
  color = 'accent',
  fullScreen = false,
  theme = 'default',
  style,
  cssVariables,
  className = '',
  grungeEffect = false,
  theatricalAnimation = false
}) => {
  const customStyles = generateCustomStyles(theme, cssVariables, style);
  const containerClassName = generateClassName(
    `loader-container themeable-component ${fullScreen ? 'fullscreen' : ''} ${
      grungeEffect && theme === 'teatro911' ? 'with-grunge-effect' : ''
    }`,
    theme,
    className
  );
  
  const spinnerClassName = `spinner spinner-${size} spinner-${color} ${
    theatricalAnimation && theme === 'teatro911' ? 'theatrical-animation' : ''
  } ${theme === 'teatro911' ? 'teatro911-spinner' : ''}`;

  return (
    <div className={containerClassName} style={customStyles}>
      <div className={spinnerClassName}>
        <div className="spinner-inner"></div>
        {theme === 'teatro911' && grungeEffect && (
          <div className="grunge-particles">
            <span></span>
            <span></span>
            <span></span>
          </div>
        )}
      </div>
    </div>
  );
};

export default Loader;
