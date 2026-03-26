import React, { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import './index.scss';

// Import SVG icons
import homeIcon from '@assets/home.svg';
import ticketsIcon from '@assets/tickets.svg';
import profileIcon from '@assets/profile.svg';
import logo from '@assets/logo.png';
import SecondaryButton from '@components/SecondaryButton';
import { IconScanTickets } from '@components/ScanIcons';

interface TopNavBarProps {
  className?: string;
  isAuthenticated?: boolean;
  logoOnly?: boolean;
  onLogout?: () => void;
  showLogout?: boolean;
  /** En barra admin: ocultar enlaces según rol partner */
  adminNavOptions?: { showScan?: boolean; showConfig?: boolean };
}

const TopNavBar: React.FC<TopNavBarProps> = ({ 
  className = '', 
  isAuthenticated = false,
  logoOnly = false,
  onLogout,
  showLogout = false,
  adminNavOptions,
}) => {
  const showScan = adminNavOptions?.showScan !== false;
  const showConfig = adminNavOptions?.showConfig !== false;
  const navigate = useNavigate();
  const location = useLocation();
  const [menuOpen, setMenuOpen] = useState(false);
  
  const isActive = (path: string): boolean => {
    return location.pathname === path;
  };

  // Function to get active or inactive icon style
  const getIconClass = (active: boolean): string => {
    return active ? 'icon-active' : 'icon-inactive';
  };
  
  const toggleMenu = () => {
    setMenuOpen(!menuOpen);
  };
  
  const handleNavigation = (path: string) => {
    navigate(path);
    setMenuOpen(false);
  };
  
  const handleLoginClick = () => {
    navigate('/login');
    setMenuOpen(false);
  };
  
  const handleSignupClick = () => {
    navigate('/signup');
    setMenuOpen(false);
  };

  // If logoOnly is true, render a simplified version with just the logo (admin)
  if (logoOnly) {
    return (
      <div className={`top-nav-bar ${className} admin-nav`}>
        {/* Mobile layout - Logo, config link and logout */}
        <div className="nav-container-mobile admin-mobile">
          <div className="logo-container-mobile" onClick={() => handleNavigation('/dashboard')}>
            <img src={logo} alt="Ticket Colombia" className="logo" />
          </div>
          <div className="admin-nav-actions">
            {showScan && (
              <button
                type="button"
                className="admin-nav-link admin-nav-scan"
                onClick={() => handleNavigation('/scan-tickets')}
              >
                <IconScanTickets size={18} />
                Leer Boletos
              </button>
            )}
            {showConfig && (
              <button
                type="button"
                className="admin-nav-link"
                onClick={() => handleNavigation('/config')}
              >
                Configuración
              </button>
            )}
            {showLogout && onLogout && (
              <SecondaryButton className="admin-logout-btn" onClick={onLogout} size="small">
                Cerrar sesión
              </SecondaryButton>
            )}
          </div>
        </div>
        
        {/* Desktop layout - Logo, config link and logout */}
        <div className="nav-container nav-container-admin">
          <div className="logo-container" onClick={() => handleNavigation('/dashboard')}>
            <img src={logo} alt="Ticket Colombia" className="logo" />
          </div>
          <div className="admin-nav-actions">
            {showScan && (
              <button
                type="button"
                className="admin-nav-link admin-nav-scan"
                onClick={() => handleNavigation('/scan-tickets')}
              >
                <IconScanTickets size={18} />
                Leer Boletos
              </button>
            )}
            {showConfig && (
              <button
                type="button"
                className="admin-nav-link"
                onClick={() => handleNavigation('/config')}
              >
                Configuración
              </button>
            )}
            {showLogout && onLogout && (
              <SecondaryButton onClick={onLogout} size="medium">
                Cerrar sesión
              </SecondaryButton>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={`top-nav-bar ${className}`}>
      {/* Mobile layout - Just centered logo */}
      <div className="nav-container-mobile">
        <div className="logo-container-mobile" onClick={() => handleNavigation('/')}>
          <img src={logo} alt="Ticket Colombia" className="logo" />
        </div>
      </div>
      
      {/* Tablet and Desktop layout */}
      <div className="nav-container">
        {/* Logo */}
        <div className="logo-container" onClick={() => handleNavigation('/')}>
          <img src={logo} alt="Ticket Colombia" className="logo" />
        </div>
        
        {/* Navigation for large screens */}
        <div className="nav-links-desktop">
          <div 
            className={`nav-link ${isActive('/') ? 'active' : ''}`}
            onClick={() => handleNavigation('/')}
          >
            <img 
              src={homeIcon} 
              alt="Eventos" 
              className={`icon ${getIconClass(isActive('/'))}`}
            />
            <span>Eventos</span>
          </div>
          
          <div 
            className={`nav-link ${isActive('/tickets') ? 'active' : ''}`}
            onClick={() => handleNavigation('/tickets')}
          >
            <img 
              src={ticketsIcon} 
              alt="Tickets" 
              className={`icon ${getIconClass(isActive('/tickets'))}`}
            />
            <span>Tickets</span>
          </div>
          
          <div 
            className={`nav-link ${isActive('/profile') ? 'active' : ''}`}
            onClick={() => handleNavigation('/profile')}
          >
            <img 
              src={profileIcon} 
              alt="Perfil" 
              className={`icon ${getIconClass(isActive('/profile'))}`}
            />
            <span>Perfil</span>
          </div>
        </div>
        
        {/* Auth buttons for desktop */}
        <div className="auth-buttons-desktop">
          {!isAuthenticated ? (
            <>
              <button className="login-button" onClick={handleLoginClick}>
                Iniciar sesión
              </button>
              <button className="signup-button" onClick={handleSignupClick}>
                Crear cuenta
              </button>
            </>
          ) : null}
        </div>
        
        {/* Hamburger menu for medium screens */}
        <div className="hamburger-menu" onClick={toggleMenu}>
          <div className={`hamburger-icon ${menuOpen ? 'open' : ''}`}>
            <span></span>
            <span></span>
            <span></span>
          </div>
        </div>
      </div>
      
      {/* Mobile menu overlay */}
      <div className={`mobile-menu ${menuOpen ? 'open' : ''}`}>
        <div className="mobile-menu-items">
          <div 
            className={`mobile-nav-link ${isActive('/') ? 'active' : ''}`}
            onClick={() => handleNavigation('/')}
          >
            <img 
              src={homeIcon} 
              alt="Eventos" 
              className={`icon ${getIconClass(isActive('/'))}`}
            />
            <span>Eventos</span>
          </div>
          
          <div 
            className={`mobile-nav-link ${isActive('/tickets') ? 'active' : ''}`}
            onClick={() => handleNavigation('/tickets')}
          >
            <img 
              src={ticketsIcon} 
              alt="Tickets" 
              className={`icon ${getIconClass(isActive('/tickets'))}`}
            />
            <span>Tickets</span>
          </div>
          
          <div 
            className={`mobile-nav-link ${isActive('/profile') ? 'active' : ''}`}
            onClick={() => handleNavigation('/profile')}
          >
            <img 
              src={profileIcon} 
              alt="Perfil" 
              className={`icon ${getIconClass(isActive('/profile'))}`}
            />
            <span>Perfil</span>
          </div>
          
          <div className="mobile-menu-auth">
            {!isAuthenticated ? (
              <>
                <button className="mobile-login-button" onClick={handleLoginClick}>
                  Iniciar sesión
                </button>
                <button className="mobile-signup-button" onClick={handleSignupClick}>
                  Crear cuenta
                </button>
              </>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
};

export default TopNavBar;
