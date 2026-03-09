import React from 'react';
import { useNavigate } from 'react-router-dom';
import PrimaryButton from '../../components/PrimaryButton';
import SecondaryButton from '../../components/SecondaryButton';
import './index.scss';
import type { CustomStyleProps } from '../../components/types';
import { generateCustomStyles, generateClassName } from '../../components/types';

interface AccountlessStateProps extends CustomStyleProps {
  title?: string;
  message?: string;
  benefits?: string[];
  icon?: string;
}

const AccountlessState: React.FC<AccountlessStateProps> = ({
  title = '¡Ups! Parece que te perdiste el chiste 😅',
  message = 'Para disfrutar de la experiencia completa, necesitas una cuenta. ¡Es gratis y súper rápido!',
  benefits = [
    '🎫 Accede a tus tickets al instante',
    '⚡ Validación rápida en taquilla',
    '📱 Todo desde tu celular',
    '🎭 No te pierdas ningún show'
  ],
  icon = '🎭',
  theme,
  style,
  cssVariables,
  className,
  grungeEffect,
  animated
}) => {
  // Generate custom styles for theming
  const customStyles = generateCustomStyles(theme, cssVariables);
  const containerClassName = generateClassName('accountless-state', theme, className);
  const navigate = useNavigate();

  const handleLoginClick = () => {
    navigate('/login');
  };

  const handleSignupClick = () => {
    navigate('/signup');
  };

  return (
    <div 
      className={containerClassName}
      style={{ ...customStyles, ...style }}
    >
      <div className="accountless-container">
        <div className="accountless-icon">
          <span className="emoji-icon">{icon}</span>
        </div>
        
        <h2>{title}</h2>
        <p className="accountless-message">{message}</p>
        
        <div className="accountless-actions">
          <PrimaryButton 
            onClick={handleSignupClick} 
            className="signup-action"
            theme={theme}
            grungeEffect={grungeEffect}
            animated={animated}
          >
            Crear cuenta gratis
          </PrimaryButton>
          <SecondaryButton 
            onClick={handleLoginClick} 
            className="login-action"
            theme={theme}
            grungeEffect={grungeEffect}
            animated={animated}
          >
            Ya tengo cuenta
          </SecondaryButton>
        </div>
        
        {benefits && benefits.length > 0 && (
          <div className="accountless-benefits">
            <h3>Con tu cuenta podrás:</h3>
            <ul>
              {benefits.map((benefit, index) => (
                <li key={index}>{benefit}</li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
};

export default AccountlessState; 