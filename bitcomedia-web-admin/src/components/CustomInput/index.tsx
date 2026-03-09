import React, { useState } from 'react';
import type { ChangeEvent, FocusEvent } from 'react';
import './index.scss';

interface CustomInputProps {
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
  className?: string;
  autoComplete?: string;
  icon?: React.ReactNode;
  maxLength?: number;
  minLength?: number;
  min?: string | number;
  max?: string | number;
  pattern?: string;
  readOnly?: boolean;
  disableArrows?: boolean;
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
  min,
  max,
  pattern,
  readOnly = false,
  disableArrows = false,
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
  
  return (
    <div className={`custom-input-container ${className} ${error ? 'has-error' : ''} ${disabled ? 'disabled' : ''} ${isFocused ? 'focused' : ''}`}>
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
          className={`custom-input ${disableArrows ? 'no-arrows' : ''}`}
          autoComplete={autoComplete}
          maxLength={maxLength}
          minLength={minLength}
          min={min}
          max={max}
          pattern={pattern}
          readOnly={readOnly}
        />
      </div>
      
      {error && <p className="custom-input-error">{error}</p>}
    </div>
  );
};

export default CustomInput; 