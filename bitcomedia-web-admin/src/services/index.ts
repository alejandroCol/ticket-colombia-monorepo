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
  getPaymentConfig,
  getContactConfig,
  updateContactConfig,
  getVenues,
  getHomeBanners,
  saveHomeBanners,
  getExpenses,
  addExpense,
  deleteExpense,
  getExpensesByEventId,
  getTotalRevenue,
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
  storage,
  functions
} from './firebase';

// Ticket service exports
export {
  createTicket,
  getUserTickets,
  getCurrentUserTickets
} from './ticketService';

// Types exports
export type { UserData, Event, Ticket, Venue } from './types';
export type { BannerItem } from './firestore';
export type { TicketData } from './ticketService'; 