import React, { useState, useEffect, useRef } from 'react';
import type { ChangeEvent } from 'react';
import type { Venue } from '@services/types';
import './index.scss';

interface VenueAutocompleteProps {
  label?: string;
  value?: string;
  placeholder?: string;
  onChange?: (e: ChangeEvent<HTMLInputElement>) => void;
  onVenueSelect?: (venue: Venue) => void;
  required?: boolean;
  disabled?: boolean;
  error?: string;
  className?: string;
  venues: Venue[];
  loading?: boolean;
  name?: string;
}

const VenueAutocomplete: React.FC<VenueAutocompleteProps> = ({
  label,
  value = '',
  placeholder,
  onChange,
  onVenueSelect,
  required = false,
  disabled = false,
  error,
  className = '',
  venues = [],
  loading = false,
  name = 'venue.name',
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [filteredVenues, setFilteredVenues] = useState<Venue[]>([]);
  const [highlightedIndex, setHighlightedIndex] = useState(-1);
  const [isFocused, setIsFocused] = useState(false);
  
  const inputRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Filter venues based on input value
  useEffect(() => {
    if (!value.trim()) {
      setFilteredVenues(venues);
      return;
    }

    const filtered = venues.filter(venue =>
      (venue.name || '').toLowerCase().includes(value.toLowerCase()) ||
      (venue.city || '').toLowerCase().includes(value.toLowerCase()) ||
      (venue.address || '').toLowerCase().includes(value.toLowerCase())
    );
    
    setFilteredVenues(filtered);
    setHighlightedIndex(-1);
  }, [value, venues]);

  // Handle input change
  const handleInputChange = (e: ChangeEvent<HTMLInputElement>) => {
    setIsOpen(true);
    if (onChange) {
      // Create a synthetic event with the correct name for the parent form
      const syntheticEvent = {
        ...e,
        target: {
          ...e.target,
          name: name,
          value: e.target.value
        }
      } as ChangeEvent<HTMLInputElement>;
      onChange(syntheticEvent);
    }
  };

  // Handle input focus
  const handleInputFocus = () => {
    setIsFocused(true);
    setIsOpen(true);
  };

  // Handle input blur
  const handleInputBlur = () => {
    setIsFocused(false);
    // Delay closing to allow for selection clicks
    setTimeout(() => {
      setIsOpen(false);
      setHighlightedIndex(-1);
    }, 200);
  };

  // Handle venue selection
  const handleVenueSelect = (venue: Venue) => {
    if (onVenueSelect) {
      onVenueSelect(venue);
    }
    setIsOpen(false);
    setHighlightedIndex(-1);
    
    // Focus back to input
    if (inputRef.current) {
      inputRef.current.focus();
    }
  };

  // Handle keyboard navigation
  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!isOpen) return;

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setHighlightedIndex(prev => 
          prev < filteredVenues.length - 1 ? prev + 1 : 0
        );
        break;
      case 'ArrowUp':
        e.preventDefault();
        setHighlightedIndex(prev => 
          prev > 0 ? prev - 1 : filteredVenues.length - 1
        );
        break;
      case 'Enter':
        e.preventDefault();
        if (highlightedIndex >= 0 && filteredVenues[highlightedIndex]) {
          handleVenueSelect(filteredVenues[highlightedIndex]);
        }
        break;
      case 'Escape':
        setIsOpen(false);
        setHighlightedIndex(-1);
        break;
    }
  };

  // Handle clicking outside to close dropdown
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node) &&
        inputRef.current &&
        !inputRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
        setHighlightedIndex(-1);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  return (
    <div className={`venue-autocomplete-container ${className} ${error ? 'has-error' : ''} ${disabled ? 'disabled' : ''} ${isFocused ? 'focused' : ''}`}>
      {label && (
        <label className="venue-autocomplete-label" htmlFor="venue-input">
          {label}{required && <span className="required-mark">*</span>}
        </label>
      )}
      
      <div className="venue-autocomplete-wrapper">
        <input
          ref={inputRef}
          id="venue-input"
          name={name}
          type="text"
          value={value}
          placeholder={placeholder}
          onChange={handleInputChange}
          onFocus={handleInputFocus}
          onBlur={handleInputBlur}
          onKeyDown={handleKeyDown}
          required={required}
          disabled={disabled || loading}
          className="venue-autocomplete-input"
          autoComplete="off"
        />
        
        {loading && (
          <div className="venue-autocomplete-loading">
            <div className="spinner"></div>
          </div>
        )}
        
        {isOpen && !loading && (
          <div ref={dropdownRef} className="venue-autocomplete-dropdown">
            {filteredVenues.length > 0 ? (
              <ul className="venue-autocomplete-list">
                {filteredVenues.map((venue, index) => (
                  <li
                    key={venue.id}
                    className={`venue-autocomplete-item ${index === highlightedIndex ? 'highlighted' : ''}`}
                    onClick={() => handleVenueSelect(venue)}
                    onMouseEnter={() => setHighlightedIndex(index)}
                  >
                    <div className="venue-name">{venue.name}</div>
                    <div className="venue-details">
                      <span className="venue-city">{venue.city}</span>
                      <span className="venue-address">{venue.address}</span>
                    </div>
                  </li>
                ))}
              </ul>
            ) : (
              <div className="venue-autocomplete-no-results">
                No se encontraron venues que coincidan con tu búsqueda
              </div>
            )}
          </div>
        )}
      </div>
      
      {error && <p className="venue-autocomplete-error">{error}</p>}
    </div>
  );
};

export default VenueAutocomplete;
