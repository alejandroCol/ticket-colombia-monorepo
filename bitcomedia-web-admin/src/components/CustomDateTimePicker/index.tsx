import React, { useState } from 'react';
import type { ChangeEvent, FocusEvent } from 'react';
import './index.scss';

interface CustomDateTimePickerProps {
  name?: string;
  label?: string;
  value?: string;
  onChange?: (e: ChangeEvent<HTMLInputElement>) => void;
  onBlur?: (e: FocusEvent<HTMLInputElement>) => void;
  onFocus?: (e: FocusEvent<HTMLInputElement>) => void;
  required?: boolean;
  disabled?: boolean;
  error?: string;
  className?: string;
  icon?: React.ReactNode;
  readOnly?: boolean;
  min?: string;
  max?: string;
  showTime?: boolean;
  timeOnly?: boolean;
}

const CustomDateTimePicker: React.FC<CustomDateTimePickerProps> = ({
  name,
  label,
  value,
  onChange,
  onBlur,
  onFocus,
  required = false,
  disabled = false,
  error,
  className = '',
  icon,
  readOnly = false,
  min,
  max,
  showTime = false,
  timeOnly = false,
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
  
  // Determine the appropriate input type
  let inputType = 'date';
  if (timeOnly) {
    inputType = 'time';
  } else if (showTime) {
    inputType = 'datetime-local';
  }
  
  return (
    <div className={`custom-datetime-container ${className} ${error ? 'has-error' : ''} ${disabled ? 'disabled' : ''} ${isFocused ? 'focused' : ''}`}>
      {label && (
        <label className="custom-datetime-label" htmlFor={name}>
          {label}{required && <span className="required-mark">*</span>}
        </label>
      )}
      
      <div className="custom-datetime-wrapper">
        {icon && <div className="custom-datetime-icon">{icon}</div>}
        
        <input
          id={name}
          name={name}
          type={inputType}
          value={value}
          onChange={onChange}
          onFocus={handleFocus}
          onBlur={handleBlur}
          required={required}
          disabled={disabled}
          className="custom-datetime"
          readOnly={readOnly}
          min={min}
          max={max}
        />
      </div>
      
      {error && <p className="custom-datetime-error">{error}</p>}
    </div>
  );
};

export default CustomDateTimePicker; 