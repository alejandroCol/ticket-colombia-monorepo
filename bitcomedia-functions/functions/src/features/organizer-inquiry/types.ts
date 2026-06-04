/** Solicitud de información desde la landing (organizadores). */
export interface OrganizerInquiryPayload {
  name: string;
  email: string;
  whatsappDial: string;
  whatsappLocal: string;
  eventAreaCode: string;
  approximateAttendees: string;
}

export interface ValidatedOrganizerInquiry {
  name: string;
  email: string;
  whatsappE164: string;
  eventAreaCode: string;
  eventAreaLabel: string;
  approximateAttendees: string;
  approximateAttendeesLabel: string;
}
