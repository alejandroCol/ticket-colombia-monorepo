/**
 * Service index file
 * Re-exports all services for easier imports
 */

// Auth service exports
export { 
  loginWithEmailAndPassword,
  createUserWithEmailAndPassword,
  logoutUser,
  onAuthStateChange,
  getCurrentUser,
  hasAdminAccess,
  sendPasswordResetEmail,
  auth
} from './auth';

// Firestore service exports
export {
  getUserData,
  createUserDocument,
  updateUserDocument,
  getEventById,
  getEventBySlug,
  getEventLabelsConfig,
  getPaymentConfig,
  getOrganizerBuyerFee,
  getContactConfig,
  getHomeBanners,
  db
} from './firestore';
export type { OrganizerBuyerFeeDoc } from './firestore';

// Storage service exports
export {
  saveUserSession,
  getUserSession,
  clearUserSession
} from './storage';

// Firebase service exports
export {
  uploadFile,
  storage
} from './firebase';

// Event service exports
export {
  getEventAvailability,
  createTicketReservation,
  releaseTicketReservation,
  getOrCreateGuestHolderSessionKey,
  GUEST_HOLDER_SESSION_KEY,
} from './eventService';
export type { AvailabilityResponse, CreateReservationResult } from './eventService';

// Ticket service exports
export {
  createTicket,
  getUserTickets,
  getCurrentUserTickets,
  transferTicket
} from './ticketService';

// Meta Pixel service exports
export { metaPixel } from './meta-pixel';

// Types exports
export type {
  UserData,
  Event,
  Ticket,
  EventSection,
  VenueMapZone,
  VenueMapConfig,
  VenueMapVisualConfig,
  VenueMapDecoration,
  VenueMapDecorationType,
} from './types';
export type { TicketData } from './ticketService'; 