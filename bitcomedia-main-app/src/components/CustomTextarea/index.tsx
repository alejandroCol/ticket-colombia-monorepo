import React, { useState } from 'react';
import type { ChangeEvent, FocusEvent } from 'react';
import './index.scss';
import type { CustomStyleProps } from '../types';
import { generateCustomStyles, generateClassName } from '../types';

interface CustomTextareaProps extends CustomStyleProps {
  name?: string;
  label?: string;
  value?: string;
  placeholder?: string;
  onChange?: (e: ChangeEvent<HTMLTextAreaElement>) => void;
  onBlur?: (e: FocusEvent<HTMLTextAreaElement>) => void;
  onFocus?: (e: FocusEvent<HTMLTextAreaElement>) => void;
  required?: boolean;
  disabled?: boolean;
  error?: string;
  rows?: number;
  maxLength?: number;
  minLength?: number;
  readOnly?: boolean;
  /** Enable grunge effects for teatro911 theme */
  grungeEffect?: boolean;
}

const CustomTextarea: React.FC<CustomTextareaProps> = ({
  name,
  label,
  value,
  placeholder,
  onChange,
  onBlur,
  onFocus,
  required = false,
  disabled = false,
  error,
  className = '',
  rows = 4,
  maxLength,
  minLength,
  readOnly = false,
  theme = 'default',
  style,
  cssVariables,
  grungeEffect = false,
}) => {
  const [isFocused, setIsFocused] = useState(false);
  
  const handleFocus = (e: FocusEvent<HTMLTextAreaElement>) => {
    setIsFocused(true);
    if (onFocus) onFocus(e);
  };
  
  const handleBlur = (e: FocusEvent<HTMLTextAreaElement>) => {
    setIsFocused(false);
    if (onBlur) onBlur(e);
  };
  
  const customStyles = generateCustomStyles(theme, cssVariables, style);
  const containerClassName = generateClassName(
    `custom-textarea-container themeable-component ${error ? 'has-error' : ''} ${disabled ? 'disabled' : ''} ${isFocused ? 'focused' : ''} ${
      grungeEffect && theme === 'teatro911' ? 'with-grunge-border' : ''
    }`,
    theme,
    className
  );

  return (
    <div className={containerClassName} style={customStyles}>
      {label && (
        <label className="custom-textarea-label" htmlFor={name}>
          {label}{required && <span className="required-mark">*</span>}
        </label>
      )}
      
      <div className="custom-textarea-wrapper">
        <textarea
          id={name}
          name={name}
          value={value}
          placeholder={placeholder}
          onChange={onChange}
          onFocus={handleFocus}
          onBlur={handleBlur}
          required={required}
          disabled={disabled}
          className="custom-textarea"
          rows={rows}
          maxLength={maxLength}
          minLength={minLength}
          readOnly={readOnly}
        />
      </div>
      
      {error && <p className="custom-textarea-error">{error}</p>}
    </div>
  );
};

export default CustomTextarea; 