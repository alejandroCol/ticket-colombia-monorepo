import React, { useRef, useState } from 'react';
import './index.scss';
import Story from '../Story';
import type { CustomStyleProps } from '../types';
import { generateCustomStyles, generateClassName } from '../types';

interface StoryData {
  id: string;
  imageUrl: string;
  imageAlt: string;
  title: string;
  onClick: () => void;
  isHighlighted?: boolean;
  size?: 'small' | 'medium' | 'large';
  animated?: boolean;
}

interface StoriesSectionProps extends CustomStyleProps {
  /** Array of story data */
  stories: StoryData[];
  /** Section title */
  title?: string;
  /** Whether to show scroll indicators */
  showScrollIndicators?: boolean;
  /** Story size for all stories in this section */
  storySize?: 'small' | 'medium' | 'large';
}

const StoriesSection: React.FC<StoriesSectionProps> = ({
  stories,
  title,
  showScrollIndicators = true,
  storySize = 'medium',
  className,
  theme,
  style,
  cssVariables,
  grungeEffect: _grungeEffect,
  animated: _animated
}) => {
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(true);

  // Generate custom styles for theming
  const customStyles = generateCustomStyles(theme, cssVariables, style);
  const containerClassName = generateClassName(
    'stories-section',
    theme,
    className
  );

  // Handle scroll and update button states
  const handleScroll = () => {
    if (!scrollContainerRef.current) return;
    
    const container = scrollContainerRef.current;
    const scrollLeft = container.scrollLeft;
    const maxScrollLeft = container.scrollWidth - container.clientWidth;
    
    setCanScrollLeft(scrollLeft > 0);
    setCanScrollRight(scrollLeft < maxScrollLeft - 1); // -1 for rounding errors
  };

  // Scroll functions
  const scrollLeft = () => {
    if (!scrollContainerRef.current) return;
    
    const container = scrollContainerRef.current;
    const scrollAmount = container.clientWidth * 0.7; // Scroll 70% of visible width
    
    container.scrollBy({
      left: -scrollAmount,
      behavior: 'smooth'
    });
  };

  const scrollRight = () => {
    if (!scrollContainerRef.current) return;
    
    const container = scrollContainerRef.current;
    const scrollAmount = container.clientWidth * 0.7; // Scroll 70% of visible width
    
    container.scrollBy({
      left: scrollAmount,
      behavior: 'smooth'
    });
  };

  // Initialize scroll state
  React.useEffect(() => {
    handleScroll();
  }, [stories]);

  if (!stories || stories.length === 0) {
    return null;
  }

  return (
    <div className={containerClassName} style={customStyles}>
      {title && (
        <div className="stories-section__header">
          <h3 className="stories-section__title">{title}</h3>
        </div>
      )}
      
      <div className="stories-section__container">
        {/* Left scroll button */}
        {showScrollIndicators && canScrollLeft && (
          <button
            className="stories-section__scroll-btn stories-section__scroll-btn--left"
            onClick={scrollLeft}
            aria-label="Scroll left"
            type="button"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
              <path
                d="M15 18L9 12L15 6"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </button>
        )}

        {/* Stories container */}
        <div
          ref={scrollContainerRef}
          className="stories-section__scroll-container"
          onScroll={handleScroll}
        >
          <div className="stories-section__stories">
            {stories.map((story) => (
              <Story
                key={story.id}
                imageUrl={story.imageUrl}
                imageAlt={story.imageAlt}
                title={story.title}
                onClick={story.onClick}
                isHighlighted={story.isHighlighted}
                size={story.size || storySize}
                animated={story.animated}
                theme={theme}
              />
            ))}
          </div>
        </div>

        {/* Right scroll button */}
        {showScrollIndicators && canScrollRight && (
          <button
            className="stories-section__scroll-btn stories-section__scroll-btn--right"
            onClick={scrollRight}
            aria-label="Scroll right"
            type="button"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
              <path
                d="M9 18L15 12L9 6"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </button>
        )}
      </div>
    </div>
  );
};

export default StoriesSection;