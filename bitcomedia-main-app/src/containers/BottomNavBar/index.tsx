import React, { useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import './index.scss';
import type { CustomStyleProps } from '../../components/types';
import { generateCustomStyles, generateClassName } from '../../components/types';

// Import SVG icons
import homeIcon from '../../assets/home.svg';
import ticketsIcon from '../../assets/tickets.svg';
import profileIcon from '../../assets/profile.svg';

interface BottomNavBarProps extends CustomStyleProps {
}

const BottomNavBar: React.FC<BottomNavBarProps> = ({ 
  className,
  theme,
  style,
  cssVariables,
  grungeEffect: _grungeEffect,
  animated: _animated
}) => {
  // Generate custom styles for theming
  const customStyles = generateCustomStyles(theme, cssVariables);
  const containerClassName = generateClassName('bottom-nav-bar', theme, className);
  const navigate = useNavigate();
  const location = useLocation();
  
  useEffect(() => {
    // Add class to body when component mounts
    document.body.classList.add('has-bottom-nav');
    
    // Remove class when component unmounts
    return () => {
      document.body.classList.remove('has-bottom-nav');
    };
  }, []);
  
  const isActive = (path: string): boolean => {
    return location.pathname === path;
  };

  // Function to get active or inactive icon style
  const getIconClass = (active: boolean): string => {
    return active ? 'icon-active' : 'icon-inactive';
  };

  return (
    <div 
      className={containerClassName}
      style={{ ...customStyles, ...style }}
    >
      <div 
        className={`nav-item ${isActive('/') ? 'active' : ''}`} 
        onClick={() => navigate('/')}
      >
        <div className="nav-icon">
          <img 
            src={homeIcon} 
            alt="Eventos" 
            className={`icon ${getIconClass(isActive('/'))}`}
          />
        </div>
        <span className="nav-label">Eventos</span>
      </div>
      
      <div 
        className={`nav-item ${isActive('/tickets') ? 'active' : ''}`} 
        onClick={() => navigate('/tickets')}
      >
        <div className="nav-icon">
          <img 
            src={ticketsIcon} 
            alt="Tickets" 
            className={`icon ${getIconClass(isActive('/tickets'))}`} 
          />
        </div>
        <span className="nav-label">Tickets</span>
      </div>
      
      <div 
        className={`nav-item ${isActive('/perfil') ? 'active' : ''}`} 
        onClick={() => navigate('/perfil')}
      >
        <div className="nav-icon">
          <img 
            src={profileIcon} 
            alt="Perfil" 
            className={`icon ${getIconClass(isActive('/perfil'))}`}
          />
        </div>
        <span className="nav-label">Perfil</span>
      </div>
    </div>
  );
};

export default BottomNavBar;
