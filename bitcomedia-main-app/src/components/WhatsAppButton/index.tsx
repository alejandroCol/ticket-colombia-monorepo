import React from 'react';
import { metaPixel } from '../../services';
import { useContactConfig } from '../../contexts/ContactConfigContext';
import './index.scss';
import type { CustomStyleProps } from '../types';
import { generateCustomStyles, generateClassName } from '../types';

interface WhatsAppButtonProps extends CustomStyleProps {
  message: string;
  eventName?: string;
  children?: React.ReactNode;
  trackingLabel?: string;
}

const WhatsAppButton: React.FC<WhatsAppButtonProps> = ({
  message,
  eventName,
  className,
  children = 'WhatsApp',
  trackingLabel = 'whatsapp-contact',
  theme,
  style,
  cssVariables,
  grungeEffect: _grungeEffect,
  animated: _animated
}) => {
  const { whatsappPhone } = useContactConfig();
  const customStyles = generateCustomStyles(theme, cssVariables);
  const containerClassName = generateClassName('whatsapp-button', theme, className);
  const handleWhatsAppContact = () => {
    const whatsappUrl = `https://wa.me/${whatsappPhone}?text=${encodeURIComponent(message)}`;

    metaPixel.trackContact(eventName || trackingLabel);

    window.open(whatsappUrl, '_blank');
  };

  return (
    <button 
      onClick={handleWhatsAppContact}
      className={containerClassName}
      style={{ ...customStyles, ...style }}
    >
      {children}
    </button>
  );
};

export default WhatsAppButton; 