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
  getPaymentConfig,
  getContactConfig,
  db
} from './firestore';

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

// Ticket service exports
export {
  createTicket,
  getUserTickets,
  getCurrentUserTickets
} from './ticketService';

// Meta Pixel service exports
export { metaPixel } from './meta-pixel';

// Types exports
export type { UserData, Event, Ticket } from './types';
export type { TicketData } from './ticketService'; 