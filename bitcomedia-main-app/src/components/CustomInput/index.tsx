import React, { useState } from 'react';
import type { ChangeEvent, FocusEvent } from 'react';
import './index.scss';
import type { CustomStyleProps } from '../types';
import { generateCustomStyles, generateClassName } from '../types';

interface CustomInputProps extends CustomStyleProps {
  type?: 'text' | 'password' | 'email' | 'number' | 'tel' | 'search' | 'url';
  name?: string;
  label?: string;
  value?: string | number;
  placeholder?: string;
  onChange?: (e: ChangeEvent<HTMLInputElement>) => void;
  onBlur?: (e: FocusEvent<HTMLInputElement>) => void;
  onFocus?: (e: FocusEvent<HTMLInputElement>) => void;
  required?: boolean;
  disabled?: boolean;
  error?: string;
  autoComplete?: string;
  icon?: React.ReactNode;
  maxLength?: number;
  minLength?: number;
  pattern?: string;
  readOnly?: boolean;
  /** Enable grunge effects for teatro911 theme */
  grungeEffect?: boolean;
}

const CustomInput: React.FC<CustomInputProps> = ({
  type = 'text',
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
  autoComplete,
  icon,
  maxLength,
  minLength,
  pattern,
  readOnly = false,
  theme = 'default',
  style,
  cssVariables,
  grungeEffect = false,
}) => {
  const [isFocused, setIsFocused] = useState(false);
  
  const handleFocus = (e: FocusEvent<HTMLInputElement>) => {
    setIsFocused(true);
    if (onFocus) onFocus(e);
  };
  
  const handleBlur = (e: FocusEvent<HTMLInputElement>) => {
    setIsFocused(false);
    if (onBlur) onBlur(e);
  };
  
  const customStyles = generateCustomStyles(theme, cssVariables, style);
  const containerClassName = generateClassName(
    `custom-input-container themeable-component ${error ? 'has-error' : ''} ${disabled ? 'disabled' : ''} ${isFocused ? 'focused' : ''} ${
      grungeEffect && theme === 'teatro911' ? 'with-grunge-border' : ''
    }`,
    theme,
    className
  );

  return (
    <div className={containerClassName} style={customStyles}>
      {label && (
        <label className="custom-input-label" htmlFor={name}>
          {label}{required && <span className="required-mark">*</span>}
        </label>
      )}
      
      <div className="custom-input-wrapper">
        {icon && <div className="custom-input-icon">{icon}</div>}
        
        <input
          id={name}
          name={name}
          type={type}
          value={value}
          placeholder={placeholder}
          onChange={onChange}
          onFocus={handleFocus}
          onBlur={handleBlur}
          required={required}
          disabled={disabled}
          className="custom-input"
          autoComplete={autoComplete}
          maxLength={maxLength}
          minLength={minLength}
          pattern={pattern}
          readOnly={readOnly}
        />
      </div>
      
      {error && <p className="custom-input-error">{error}</p>}
    </div>
  );
};

export default CustomInput; 