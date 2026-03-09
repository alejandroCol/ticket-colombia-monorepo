import React, { useState } from 'react';
import type { ChangeEvent, FocusEvent } from 'react';
import './index.scss';

interface CustomTextareaProps {
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
  className?: string;
  rows?: number;
  maxLength?: number;
  minLength?: number;
  readOnly?: boolean;
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
  
  return (
    <div className={`custom-textarea-container ${className} ${error ? 'has-error' : ''} ${disabled ? 'disabled' : ''} ${isFocused ? 'focused' : ''}`}>
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