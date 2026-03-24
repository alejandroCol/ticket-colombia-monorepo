import React from 'react';
import { useNavigate } from 'react-router-dom';
import PrimaryButton from '../../components/PrimaryButton';
import SecondaryButton from '../../components/SecondaryButton';
import { ProfileIconTicket } from '../../components/ProfileScreenIcons';
import './index.scss';
import type { CustomStyleProps } from '../../components/types';
import { generateCustomStyles, generateClassName } from '../../components/types';

interface AccountlessStateProps extends CustomStyleProps {
  title?: string;
  message?: string;
  benefits?: string[];
  benefitsTitle?: string;
  icon?: string;
  /** Eyebrow line above the title (e.g. “Mis entradas”) */
  eyebrow?: string;
  /** Visual layout aligned with tickets / profile heroes */
  variant?: 'default' | 'tickets';
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
  benefitsTitle = 'Con tu cuenta podrás:',
  icon = '🎭',
  eyebrow,
  variant = 'default',
  theme,
  style,
  cssVariables,
  className,
  grungeEffect,
  animated
}) => {
  // Generate custom styles for theming
  const customStyles = generateCustomStyles(theme, cssVariables);
  const variantClass = variant === 'tickets' ? 'accountless-state--tickets' : '';
  const containerClassName = generateClassName(
    'accountless-state',
    theme,
    [variantClass, className].filter(Boolean).join(' ')
  );
  const navigate = useNavigate();

  const handleLoginClick = () => {
    navigate('/login');
  };

  const handleSignupClick = () => {
    navigate('/signup');
  };

  const content = (
    <>
      {eyebrow ? (
        <p className="accountless-eyebrow">{eyebrow}</p>
      ) : null}

      <div
        className={
          variant === 'tickets'
            ? 'accountless-icon accountless-icon--ticket-mark'
            : 'accountless-icon'
        }
      >
        {variant === 'tickets' ? (
          <span className="accountless-icon__ticket-ring" aria-hidden>
            <ProfileIconTicket size={36} />
          </span>
        ) : (
          <span className="emoji-icon">{icon}</span>
        )}
      </div>

      <h2 className="accountless-title">{title}</h2>
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

      {benefits && benefits.length > 0 ? (
        <div className="accountless-benefits">
          <h3>{benefitsTitle}</h3>
          <ul>
            {benefits.map((benefit, index) => (
              <li key={index}>{benefit}</li>
            ))}
          </ul>
        </div>
      ) : null}
    </>
  );

  return (
    <div
      className={containerClassName}
      style={{ ...customStyles, ...style }}
    >
      <div className="accountless-container">
        {variant === 'tickets' ? (
          <div className="accountless-card-inner">{content}</div>
        ) : (
          content
        )}
      </div>
    </div>
  );
};

export default AccountlessState; 