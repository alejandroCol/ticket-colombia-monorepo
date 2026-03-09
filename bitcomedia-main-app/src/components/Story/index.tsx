import React from 'react';
import './index.scss';
import type { CustomStyleProps } from '../types';
import { generateCustomStyles, generateClassName } from '../types';

interface StoryProps extends CustomStyleProps {
  /** Image URL for the story */
  imageUrl: string;
  /** Alt text for the image */
  imageAlt: string;
  /** Title/label displayed below the story circle */
  title: string;
  /** Callback function when story is clicked */
  onClick: () => void;
  /** Whether this story is highlighted/featured */
  isHighlighted?: boolean;
  /** Size variant */
  size?: 'small' | 'medium' | 'large';
}

const Story: React.FC<StoryProps> = ({
  imageUrl,
  imageAlt,
  title,
  onClick,
  isHighlighted = false,
  size = 'medium',
  className,
  theme,
  style,
  cssVariables,
  grungeEffect: _grungeEffect,
  animated
}) => {
  // Generate custom styles for theming
  const customStyles = generateCustomStyles(theme, cssVariables, style);
  const containerClassName = generateClassName(
    `story story--${size}${isHighlighted ? ' story--highlighted' : ''}${animated ? ' story--animated' : ''}`,
    theme,
    className
  );

  return (
    <div 
      className={containerClassName}
      style={customStyles}
      onClick={onClick}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onClick();
        }
      }}
    >
      <div className="story__ring">
        <div className="story__image-container">
          <img 
            src={imageUrl} 
            alt={imageAlt}
            className="story__image"
          />
        </div>
      </div>
      <span className="story__title">{title}</span>
    </div>
  );
};

export default Story;