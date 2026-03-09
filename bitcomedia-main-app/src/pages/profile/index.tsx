import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { getCurrentUser, getUserData, logoutUser, sendPasswordResetEmail } from '../../services';
import AccountlessState from '../../containers/AccountlessState';
import BottomNavBar from '../../containers/BottomNavBar';
import TopNavBar from '../../containers/TopNavBar';
import PrimaryButton from '../../components/PrimaryButton';
import SecondaryButton from '../../components/SecondaryButton';
import WhatsAppButton from '../../components/WhatsAppButton';
import Loader from '../../components/Loader';
import './index.scss';
import type { UserData } from '../../services';

const ProfileScreen: React.FC = () => {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [userData, setUserData] = useState<UserData | null>(null);
  const [passwordResetSent, setPasswordResetSent] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const navigate = useNavigate();

  useEffect(() => {
    const checkAuthStatus = async () => {
      const user = getCurrentUser();
      
      if (user) {
        setIsAuthenticated(true);
        
        try {
          const userDataResult = await getUserData(user.uid);
          setUserData(userDataResult);
        } catch (error) {
          console.error('Error al obtener datos del usuario:', error);
        }
      }
      
      setIsLoading(false);
    };
    
    checkAuthStatus();
  }, []);

  const handleLogout = async () => {
    try {
      await logoutUser();
      setIsAuthenticated(false);
      navigate('/');
    } catch (error) {
      console.error('Error al cerrar sesión:', error);
    }
  };

  const handleChangePassword = async () => {
    try {
      if (userData?.email) {
        await sendPasswordResetEmail(userData.email);
        setPasswordResetSent(true);
        setErrorMessage(null);
        
        // Reset notification after 5 seconds
        setTimeout(() => {
          setPasswordResetSent(false);
        }, 5000);
      }
    } catch (error) {
      console.error('Error al enviar correo de cambio de contraseña:', error);
      setErrorMessage('Error al enviar correo de cambio de contraseña');
      
      // Reset error message after 5 seconds
      setTimeout(() => {
        setErrorMessage(null);
      }, 5000);
    }
  };

  if (isLoading) {
    return <Loader fullScreen />;
  }

  if (!isAuthenticated) {
    return (
      <div className="profile-screen">
        <TopNavBar isAuthenticated={isAuthenticated} />
        
        <div className="profile-content">
          <AccountlessState 
            title="¡Tu perfil te está esperando! 🎭" 
            message="Únete a nuestra comunidad y personaliza tu experiencia. ¡Es más fácil de lo que crees!"
            benefits={[
              '👤 Perfil personalizado y único',
              '🎫 Gestión fácil de tus entradas',
              '⚡ Compras más rápidas',
              '🔔 Notificaciones de nuevos shows',
              '🎭 Recomendaciones personalizadas'
            ]}
            icon="🎭"
          />
          <div className="bottom-nav-spacer"></div>
        </div>
        
        <BottomNavBar />
      </div>
    );
  }

  return (
    <div className="profile-screen">
      <TopNavBar 
        isAuthenticated={isAuthenticated} 
      />
      
      <div className="profile-header">
        <h1>Mi Perfil</h1>
        <SecondaryButton onClick={() => navigate('/')}>
          ← Volver al inicio
        </SecondaryButton>
      </div>

      <div className="profile-content authenticated">
        <div className="profile-card">
          <div className="profile-avatar">
            {userData?.name?.charAt(0) || 'U'}
          </div>
          
          <div className="profile-info">
            <h2>{userData?.name || 'Usuario'}</h2>
            <p className="profile-email">{userData?.email}</p>
            <p className="profile-phone">{userData?.phone || 'Sin teléfono'}</p>
            <p className="profile-location">{userData?.city || 'Sin ubicación'}</p>
          </div>
          
          {passwordResetSent && (
            <div className="password-reset-success">
              Se ha enviado un correo con instrucciones para cambiar tu contraseña.
            </div>
          )}
          
          {errorMessage && (
            <div className="password-reset-error">
              {errorMessage}
            </div>
          )}
          
          <div className="profile-actions">
            <PrimaryButton onClick={() => navigate('/editar-perfil')}>
              Editar perfil
            </PrimaryButton>
            <SecondaryButton onClick={handleChangePassword}>
              Cambiar contraseña
            </SecondaryButton>
            <SecondaryButton onClick={handleLogout}>
              Cerrar sesión
            </SecondaryButton>
          </div>
        </div>

        <div className="profile-section contact-section">
          <h3>Contacto y soporte</h3>
          <div className="contact-content">
            <p className="contact-description">
              ¿Necesitas ayuda o tienes alguna pregunta? ¡Contáctanos!
            </p>
            
            <div className="social-links">
              <h4>Síguenos en redes sociales</h4>
              <div className="social-buttons">
                <SecondaryButton
                  onClick={() => window.open('https://www.instagram.com/ticketcolombia/', '_blank')}
                  size="medium"
                >
                  📷 Instagram
                </SecondaryButton>
                <SecondaryButton
                  onClick={() => window.open('https://www.tiktok.com/@ticketcolombia', '_blank')}
                  size="medium"
                >
                  🎵 TikTok
                </SecondaryButton>
              </div>
            </div>

            <div className="whatsapp-contact">
              <h4>Soporte directo</h4>
              <p>¿Necesitas ayuda personalizada? Contáctanos por{' '}
                <WhatsAppButton 
                  message={`Hola, necesito ayuda con:\n\n[Describe tu consulta aquí]\n\n¡Gracias!`}
                  eventName={userData?.name || 'usuario'}
                  trackingLabel="profile-contact"
                >
                  WhatsApp
                </WhatsAppButton>
              </p>
            </div>
          </div>
        </div>
        
        <div className="bottom-nav-spacer"></div>
      </div>
      
      <BottomNavBar />
    </div>
  );
};

export default ProfileScreen;
