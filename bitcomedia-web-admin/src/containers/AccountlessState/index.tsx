import React from 'react';
import { useNavigate } from 'react-router-dom';
import PrimaryButton from '@components/PrimaryButton';
import SecondaryButton from '@components/SecondaryButton';
import './index.scss';

interface AccountlessStateProps {
  title?: string;
  message?: string;
}

const AccountlessState: React.FC<AccountlessStateProps> = ({
  title = 'Acceso restringido',
  message = 'Debes iniciar sesión para acceder a esta sección'
}) => {
  const navigate = useNavigate();

  const handleLoginClick = () => {
    navigate('/login');
  };

  const handleSignupClick = () => {
    navigate('/signup');
  };

  return (
    <div className="accountless-state">
      <div className="accountless-container">
        <div className="accountless-icon">
          <i className="lock-icon"></i>
        </div>
        
        <h2>{title}</h2>
        <p className="accountless-message">{message}</p>
        
        <div className="accountless-actions">
          <PrimaryButton onClick={handleLoginClick} className="login-action">
            Iniciar sesión
          </PrimaryButton>
          <SecondaryButton onClick={handleSignupClick} className="signup-action">
            Crear cuenta
          </SecondaryButton>
        </div>
      </div>
    </div>
  );
};

export default AccountlessState; 