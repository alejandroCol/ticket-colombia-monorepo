import React, { useState, useEffect } from 'react';
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
  adminNavOptions?: { showScan?: boolean; showConfig?: boolean; showTaquilla?: boolean };
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
  const showTaquilla = adminNavOptions?.showTaquilla === true;
  const navigate = useNavigate();
  const location = useLocation();
  const [menuOpen, setMenuOpen] = useState(false);
  /** Menú hamburguesa solo en admin móvil (`logoOnly`). */
  const [adminMobileMenuOpen, setAdminMobileMenuOpen] = useState(false);
  
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

  const toggleAdminMobileMenu = () => {
    setAdminMobileMenuOpen((o) => !o);
  };
  
  const handleNavigation = (path: string) => {
    navigate(path);
    setMenuOpen(false);
    setAdminMobileMenuOpen(false);
  };

  const handleAdminLogoutClick = () => {
    setAdminMobileMenuOpen(false);
    onLogout?.();
  };

  useEffect(() => {
    if (logoOnly) setAdminMobileMenuOpen(false);
  }, [location.pathname, logoOnly]);
  
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
        {/* Mobile: logo + hamburguesa */}
        <div className="nav-container-mobile admin-mobile">
          <div className="logo-container-mobile" onClick={() => handleNavigation('/dashboard')}>
            <img src={logo} alt="Ticket Colombia" className="logo" />
          </div>
          <button
            type="button"
            className="admin-nav-hamburger"
            aria-expanded={adminMobileMenuOpen}
            aria-controls="admin-mobile-nav-drawer"
            aria-label={adminMobileMenuOpen ? 'Cerrar menú' : 'Abrir menú'}
            onClick={toggleAdminMobileMenu}
          >
            <div className={`hamburger-icon ${adminMobileMenuOpen ? 'open' : ''}`}>
              <span />
              <span />
              <span />
            </div>
          </button>
        </div>

        <button
          type="button"
          className={`admin-mobile-backdrop ${adminMobileMenuOpen ? 'is-visible' : ''}`}
          aria-hidden={!adminMobileMenuOpen}
          tabIndex={-1}
          onClick={() => setAdminMobileMenuOpen(false)}
        />

        <div
          className={`admin-mobile-drawer ${adminMobileMenuOpen ? 'open' : ''}`}
          id="admin-mobile-nav-drawer"
          role="navigation"
          aria-hidden={!adminMobileMenuOpen}
        >
          <div className="admin-mobile-drawer-inner">
            {showScan && (
              <button
                type="button"
                className="admin-mobile-drawer-link admin-mobile-drawer-link--scan"
                onClick={() => handleNavigation('/scan-tickets')}
              >
                <IconScanTickets size={20} />
                Leer Boletos
              </button>
            )}
            {showTaquilla && (
              <button
                type="button"
                className="admin-mobile-drawer-link"
                onClick={() => handleNavigation('/taquilla')}
              >
                Taquilla
              </button>
            )}
            {showConfig && (
              <button
                type="button"
                className="admin-mobile-drawer-link"
                onClick={() => handleNavigation('/config')}
              >
                Configuración
              </button>
            )}
            <button
              type="button"
              className="admin-mobile-drawer-link"
              onClick={() => handleNavigation('/account/password')}
            >
              Cambiar contraseña
            </button>
            {showLogout && onLogout && (
              <SecondaryButton
                className="admin-mobile-drawer-logout"
                onClick={handleAdminLogoutClick}
                size="small"
                fullWidth
              >
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
            {showTaquilla && (
              <button
                type="button"
                className="admin-nav-link admin-nav-taquilla"
                onClick={() => handleNavigation('/taquilla')}
              >
                Venta taquilla
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
            <button
              type="button"
              className="admin-nav-link"
              onClick={() => handleNavigation('/account/password')}
            >
              Cambiar contraseña
            </button>
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
