import { httpsCallable } from 'firebase/functions';
import { functions } from './firebase';

export async function fetchMercadoPagoSellerOAuthUrl(organizerId: string): Promise<string> {
  const fn = httpsCallable<{ organizerId: string }, { url: string }>(functions, 'getMercadoPagoSellerOAuthUrl');
  const res = await fn({ organizerId });
  const url = res.data?.url?.trim();
  if (!url) {
    throw new Error('No se recibió la URL de autorización de Mercado Pago.');
  }
  return url;
}
