// Extender el objeto Window para incluir fbq
declare global {
  interface Window {
    fbq?: (action: string, eventName: string, parameters?: Record<string, unknown>) => void;
  }
}

class MetaPixelService {
  // Verificar si fbq está disponible
  private isFbqAvailable(): boolean {
    return typeof window !== 'undefined' && typeof window.fbq === 'function';
  }

  // Método genérico para trackear eventos
  private track(eventName: string, parameters?: Record<string, unknown>) {
    if (!this.isFbqAvailable() || !window.fbq) {
      console.warn('Meta Pixel no está disponible');
      return;
    }

    try {
      if (parameters) {
        window.fbq('track', eventName, parameters);
      } else {
        window.fbq('track', eventName);
      }

      // Log solo en desarrollo
      if (import.meta.env.DEV) {
        console.log(`Meta Pixel: ${eventName}`, parameters || '');
      }
    } catch (error) {
      console.error(`Error tracking ${eventName}:`, error);
    }
  }

  // Event tracking methods

  // Página vista (ya se ejecuta automáticamente, pero por si necesitas manualmente)
  trackPageView() {
    this.track('PageView');
  }

  // Ver contenido (evento, detalles del show)
  trackViewContent(eventName: string, eventPrice?: number) {
    const parameters: Record<string, unknown> = {
      content_name: eventName,
      content_type: 'event',
      currency: 'COP'
    };

    if (eventPrice !== undefined && eventPrice > 0) {
      parameters.value = eventPrice;
    }

    this.track('ViewContent', parameters);
  }

  // Iniciar checkout
  trackInitiateCheckout(eventName: string, value: number, quantity: number) {
    this.track('InitiateCheckout', {
      content_name: eventName,
      value: value,
      currency: 'COP',
      quantity: quantity
    });
  }

  // Compra completada
  trackPurchase(eventName: string, value: number, quantity: number, orderId?: string) {
    const parameters: Record<string, unknown> = {
      content_name: eventName,
      value: value,
      currency: 'COP',
      quantity: quantity
    };

    if (orderId) {
      parameters.order_id = orderId;
    }

    this.track('Purchase', parameters);
  }

  // Registro completado
  trackCompleteRegistration() {
    this.track('CompleteRegistration', {
      registration_method: 'email'
    });
  }

  // Login
  trackLogin() {
    this.track('Login', {
      login_method: 'email'
    });
  }

  // Contacto via WhatsApp
  trackContact(eventName?: string) {
    const parameters: Record<string, unknown> = {
      contact_method: 'whatsapp'
    };

    if (eventName) {
      parameters.content_name = eventName;
    }

    this.track('Contact', parameters);
  }

  // Lead - cuando alguien muestra interés en un evento
  trackLead(eventName: string) {
    this.track('Lead', {
      content_name: eventName,
      content_type: 'event'
    });
  }
}

// Exportar instancia única
export const metaPixel = new MetaPixelService(); 