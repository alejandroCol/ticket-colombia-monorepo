import { getFunctions, httpsCallable } from 'firebase/functions';
import { app } from './firebase';

const functions = getFunctions(app);

export interface SubmitOrganizerInquiryRequest {
  name: string;
  email: string;
  whatsappDial: string;
  whatsappLocal: string;
  eventAreaCode: string;
  approximateAttendees: string;
}

export async function submitOrganizerInquiry(
  payload: SubmitOrganizerInquiryRequest
): Promise<{ success: boolean }> {
  const fn = httpsCallable<SubmitOrganizerInquiryRequest, { success: boolean }>(
    functions,
    'submitOrganizerInquiry'
  );
  const result = await fn(payload);
  return result.data;
}
