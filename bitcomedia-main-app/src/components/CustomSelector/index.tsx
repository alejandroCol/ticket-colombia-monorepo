import React, { useState } from 'react';
import type { ChangeEvent, FocusEvent } from 'react';
import './index.scss';

interface Option {
  value: string | number;
  label: string;
}

interface CustomSelectorProps {
  name?: string;
  label?: string;
  value?: string | number;
  options: Option[];
  onChange?: (e: ChangeEvent<HTMLSelectElement>) => void;
  onBlur?: (e: FocusEvent<HTMLSelectElement>) => void;
  onFocus?: (e: FocusEvent<HTMLSelectElement>) => void;
  required?: boolean;
  disabled?: boolean;
  error?: string;
  className?: string;
  icon?: React.ReactNode;
  placeholder?: string;
}

const CustomSelector: React.FC<CustomSelectorProps> = ({
  name,
  label,
  value,
  options,
  onChange,
  onBlur,
  onFocus,
  required = false,
  disabled = false,
  error,
  className = '',
  icon,
  placeholder,
}) => {
  const [isFocused, setIsFocused] = useState(false);
  
  const handleFocus = (e: FocusEvent<HTMLSelectElement>) => {
    setIsFocused(true);
    if (onFocus) onFocus(e);
  };
  
  const handleBlur = (e: FocusEvent<HTMLSelectElement>) => {
    setIsFocused(false);
    if (onBlur) onBlur(e);
  };
  
  return (
    <div className={`custom-selector-container ${className} ${error ? 'has-error' : ''} ${disabled ? 'disabled' : ''} ${isFocused ? 'focused' : ''}`}>
      {label && (
        <label className="custom-selector-label" htmlFor={name}>
          {label}{required && <span className="required-mark">*</span>}
        </label>
      )}
      
      <div className="custom-selector-wrapper">
        {icon && <div className="custom-selector-icon">{icon}</div>}
        
        <select
          id={name}
          name={name}
          value={value}
          onChange={onChange}
          onFocus={handleFocus}
          onBlur={handleBlur}
          required={required}
          disabled={disabled}
          className="custom-selector"
        >
          {placeholder && (
            <option value="" disabled>
              {placeholder}
            </option>
          )}
          
          {options.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </div>
      
      {error && <p className="custom-selector-error">{error}</p>}
    </div>
  );
};

export default CustomSelector; 