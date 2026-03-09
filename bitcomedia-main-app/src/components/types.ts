// Common types for customizable component styling

export interface CustomStyleProps {
  /** 
   * Custom inline styles that override default component styles 
   */
  style?: React.CSSProperties;
  
  /** 
   * Theme variant to apply to the component 
   */
  theme?: 'default' | 'teatro911';
  
  /** 
   * Custom CSS variables to inject into the component's style context 
   */
  cssVariables?: Record<string, string>;
  
  /** 
   * Additional CSS classes 
   */
  className?: string;
  
  /** 
   * Specific props for Teatro911 theme effects 
   */
  grungeEffect?: boolean;
  
  /** 
   * Enable animated effects for the component 
   */
  animated?: boolean;
  
  /** 
   * Enable theatrical animations for loaders 
   */
  theatricalAnimation?: boolean;
}

/**
 * Helper function to generate style object with CSS variables and theme
 */
export const generateCustomStyles = (
  _theme?: 'default' | 'teatro911',
  cssVariables?: Record<string, string>,
  style?: React.CSSProperties
): React.CSSProperties => {
  return {
    ...cssVariables,
    ...style,
  };
};

/**
 * Helper function to generate className with theme
 */
export const generateClassName = (
  baseClass: string,
  theme?: 'default' | 'teatro911',
  additionalClasses?: string
): string => {
  return `${baseClass} ${theme === 'teatro911' ? 'teatro911-theme' : 'default-theme'} ${additionalClasses || ''}`.trim();
};

// Common CSS variable names that components can use
export const CSS_VARIABLES = {
  // Colors
  PRIMARY_COLOR: '--component-primary-color',
  SECONDARY_COLOR: '--component-secondary-color',
  ACCENT_COLOR: '--component-accent-color',
  TEXT_PRIMARY: '--component-text-primary',
  TEXT_SECONDARY: '--component-text-secondary',
  SURFACE_COLOR: '--component-surface-color',
  BORDER_COLOR: '--component-border-color',
  
  // Typography
  FONT_FAMILY: '--component-font-family',
  FONT_SIZE: '--component-font-size',
  FONT_WEIGHT: '--component-font-weight',
  LINE_HEIGHT: '--component-line-height',
  
  // Spacing
  PADDING: '--component-padding',
  MARGIN: '--component-margin',
  BORDER_RADIUS: '--component-border-radius',
  
  // Effects
  BOX_SHADOW: '--component-box-shadow',
  TRANSITION: '--component-transition',
} as const;