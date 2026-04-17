import React, { useId, useState } from 'react';
import type { ChangeEvent, FocusEvent } from 'react';
import './index.scss';

interface CustomInputProps {
  type?: 'text' | 'password' | 'email' | 'number' | 'tel' | 'search' | 'url' | 'date';
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
  /** Si type es password: muestra botón para ver/ocultar */
  showPasswordToggle?: boolean;
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
  showPasswordToggle = false,
}) => {
  const [isFocused, setIsFocused] = useState(false);
  const [passwordVisible, setPasswordVisible] = useState(false);
  const autoId = useId();
  const inputId = name || autoId;
  const isPasswordField = type === 'password';
  const showToggle = isPasswordField && showPasswordToggle && !disabled;
  const inputType = showToggle && passwordVisible ? 'text' : type;
  
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
        <label className="custom-input-label" htmlFor={inputId}>
          {label}{required && <span className="required-mark">*</span>}
        </label>
      )}
      
      <div
        className={`custom-input-wrapper${showToggle ? ' custom-input-wrapper--with-toggle' : ''}`}
      >
        {icon && <div className="custom-input-icon">{icon}</div>}
        
        <input
          id={inputId}
          name={name}
          type={inputType}
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
        {showToggle ? (
          <button
            type="button"
            className="custom-input-password-toggle"
            onClick={() => setPasswordVisible((v) => !v)}
            aria-label={passwordVisible ? 'Ocultar contraseña' : 'Ver contraseña'}
            aria-pressed={passwordVisible}
          >
            {passwordVisible ? (
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden>
                <path
                  d="M3 3l18 18M10.5 10.677a2 2 0 102.823 2.823M7.362 7.561C8.732 6.64 10.3 6 12 6c4.5 0 8.33 3.33 10 8-0.38 1.19-0.88 2.25-1.47 3.14M9.88 9.88a3 3 0 004.24 4.24"
                  stroke="currentColor"
                  strokeWidth="1.75"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            ) : (
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden>
                <path
                  d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7-11-7-11-7z"
                  stroke="currentColor"
                  strokeWidth="1.75"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
                <circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth="1.75" />
              </svg>
            )}
          </button>
        ) : null}
      </div>
      
      {error && <p className="custom-input-error">{error}</p>}
    </div>
  );
};

export default CustomInput; 