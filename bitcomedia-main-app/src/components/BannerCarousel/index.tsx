import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import './index.scss';

export interface BannerItem {
  id?: string;
  url: string;
  order?: number;
  title?: string;
  date?: string;
  eventSlug?: string;
}

interface BannerCarouselProps {
  banners: BannerItem[];
  intervalMs?: number;
}

const BannerCarousel: React.FC<BannerCarouselProps> = ({ 
  banners, 
  intervalMs = 5000 
}) => {
  const [activeIndex, setActiveIndex] = useState(0);
  const navigate = useNavigate();

  useEffect(() => {
    if (banners.length <= 1) return;
    
    const timer = setInterval(() => {
      setActiveIndex((prev) => (prev + 1) % banners.length);
    }, intervalMs);
    
    return () => clearInterval(timer);
  }, [banners.length, intervalMs]);

  if (!banners || banners.length === 0) return null;

  const formatDate = (dateStr?: string) => {
    if (!dateStr) return '';
    const [y, m, d] = dateStr.split('-').map(Number);
    const date = new Date(y, m - 1, d);
    return date.toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
  };

  return (
    <section className="banner-carousel" aria-label="Banner promocional">
      <div className="banner-carousel__track">
        {banners.map((banner, index) => (
          <div
            key={banner.id || index}
            className={`banner-carousel__slide ${index === activeIndex ? 'active' : ''}`}
            style={{ '--banner-index': index } as React.CSSProperties}
          >
            <div className="banner-carousel__image-wrapper">
              <img
                src={banner.url}
                alt={banner.title || `Banner ${index + 1}`}
                className="banner-carousel__image"
              />
            </div>
            {(banner.title || banner.date || banner.eventSlug) && (
              <div className="banner-carousel__overlay">
                <div className="banner-carousel__overlay-content">
                  {banner.title && (
                    <h2 className="banner-carousel__title">{banner.title}</h2>
                  )}
                  {banner.date && (
                    <p className="banner-carousel__date">{formatDate(banner.date)}</p>
                  )}
                  {(banner.eventSlug || banner.title) && (
                    <button
                      type="button"
                      className="banner-carousel__cta"
                      onClick={() =>
                        banner.eventSlug
                          ? navigate(`/evento/${banner.eventSlug}`)
                          : navigate('/')
                      }
                    >
                      Comprar boleto
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
      
      {banners.length > 1 && (
        <div className="banner-carousel__indicators" role="tablist">
          {banners.map((_, index) => (
            <button
              key={index}
              type="button"
              role="tab"
              aria-selected={index === activeIndex}
              aria-label={`Ir a banner ${index + 1}`}
              className={`banner-carousel__indicator ${index === activeIndex ? 'active' : ''}`}
              onClick={() => setActiveIndex(index)}
            />
          ))}
        </div>
      )}
    </section>
  );
};

export default BannerCarousel;
