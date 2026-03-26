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
  hasPanelAccess,
  isPartnerUserAuth,
  isSuperAdmin,
  sendPasswordResetEmail,
  auth
} from './auth';

// Firestore service exports
export {
  getUserData,
  createUserDocument,
  updateUserDocument,
  getEventById,
  getEventOrRecurringById,
  getPaymentConfig,
  getOrganizerBuyerFee,
  setOrganizerBuyerFee,
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
  getAdminUsersList,
  fetchOrganizerEventsIndex,
  setEventOrganizerId,
  db
} from './firestore';

export {
  saveVenueMapTemplate,
  listVenueMapTemplates,
  getVenueMapTemplate,
  deleteVenueMapTemplate,
} from './venueMapTemplates';

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
  functions,
  secondaryApp,
} from './firebase';

export { createPartnerUserAccount } from './createPartnerUserAccount';

// Ticket service exports
export {
  createTicket,
  getUserTickets,
  getCurrentUserTickets,
  getTicketsSince,
  isTicketValidForSalesStats,
  ticketCreatedAtMs
} from './ticketService';

// Types exports
export type {
  UserData,
  Event,
  Ticket,
  Venue,
  VenueMapTemplateDocument,
  VenueMapTemplateZoneLayout,
} from './types';
export type { BannerItem, OrganizerBuyerFeeDoc, OrganizerEventsIndex } from './firestore';
export type { TicketData, CreateReservationResult } from './ticketService';

export {
  partnerGrantDocId,
  DEFAULT_PARTNER_PERMISSIONS,
  getPartnerGrantForEvent,
  getAnyPartnerGrantForTicketEvent,
  partnerCanReadTicket,
  partnerCanValidateTicket,
  listPartnerGrantsForUser,
  listAllPartnerGrants,
  upsertPartnerGrant,
  deletePartnerGrant,
  getPartnerCandidateUsers,
} from './partnerGrants';
export type { PartnerEventPermissions, PartnerEventGrant } from './partnerGrants';