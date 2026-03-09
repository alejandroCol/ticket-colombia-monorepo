import React from 'react';
import './index.scss';

interface LoaderProps {
  size?: 'small' | 'medium' | 'large';
  color?: 'primary' | 'secondary' | 'accent';
  fullScreen?: boolean;
}

const Loader: React.FC<LoaderProps> = ({ 
  size = 'medium', 
  color = 'accent',
  fullScreen = false 
}) => {
  return (
    <div className={`loader-container ${fullScreen ? 'fullscreen' : ''}`}>
      <div className={`spinner spinner-${size} spinner-${color}`}>
        <div className="spinner-inner"></div>
      </div>
    </div>
  );
};

export default Loader;
