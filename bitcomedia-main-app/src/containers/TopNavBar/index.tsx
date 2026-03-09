import React, { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import './index.scss';
import type { CustomStyleProps } from '../../components/types';
import { generateCustomStyles, generateClassName } from '../../components/types';

// Import SVG icons
import homeIcon from '../../assets/home.svg';
import ticketsIcon from '../../assets/tickets.svg';
import profileIcon from '../../assets/profile.svg';
import logo from '../../assets/logo.png';

interface TopNavBarProps extends CustomStyleProps {
  isAuthenticated?: boolean;
  logoOnly?: boolean;
}

const TopNavBar: React.FC<TopNavBarProps> = ({ 
  className, 
  isAuthenticated = false,
  logoOnly = false,
  theme,
  style,
  cssVariables,
  grungeEffect: _grungeEffect,
  animated: _animated
}) => {
  // Generate custom styles for theming
  const customStyles = generateCustomStyles(theme, cssVariables);
  const containerClassName = generateClassName('top-nav-bar', theme, className);
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
    navigate('/iniciar-sesion');
    setMenuOpen(false);
  };
  
  const handleSignupClick = () => {
    navigate('/crear-cuenta');
    setMenuOpen(false);
  };

  // If logoOnly is true, render a simplified version with just the logo
  if (logoOnly) {
    return (
      <div 
        className={containerClassName}
        style={{ ...customStyles, ...style }}
      >
        {/* Mobile layout - Just centered logo */}
        <div className="nav-container-mobile">
          <div className="logo-container-mobile" onClick={() => handleNavigation('/')}>
            <img src={logo} alt="Ticket Colombia" className="logo" />
          </div>
        </div>
        
        {/* Desktop layout - Just the logo */}
        <div className="nav-container nav-container-logo-only">
          <div className="logo-container" onClick={() => handleNavigation('/')}>
            <img src={logo} alt="Bitcomedia" className="logo" />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div 
      className={containerClassName}
      style={{ ...customStyles, ...style }}
    >
      {/* Mobile layout - Just centered logo */}
      <div className="nav-container-mobile">
        <div className="logo-container-mobile" onClick={() => handleNavigation('/')}>
          <img src={logo} alt="Bitcomedia" className="logo" />
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
            className={`nav-link ${isActive('/perfil') ? 'active' : ''}`}
            onClick={() => handleNavigation('/perfil')}
          >
            <img 
              src={profileIcon} 
              alt="Perfil" 
              className={`icon ${getIconClass(isActive('/perfil'))}`}
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
            className={`mobile-nav-link ${isActive('/perfil') ? 'active' : ''}`}
            onClick={() => handleNavigation('/perfil')}
          >
            <img 
              src={profileIcon} 
              alt="Perfil" 
              className={`icon ${getIconClass(isActive('/perfil'))}`}
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
