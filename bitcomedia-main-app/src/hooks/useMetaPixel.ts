import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { metaPixel } from '../services';

// Hook simple para trackear cambios de página
export const usePageTracking = () => {
  const location = useLocation();

  useEffect(() => {
    // Pequeño delay para asegurar que la página se ha cargado
    const timeoutId = setTimeout(() => {
      metaPixel.trackPageView();
    }, 100);

    return () => clearTimeout(timeoutId);
  }, [location.pathname]);
}; 