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
  changePasswordWithCurrent,
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
  updatePaymentProviderConfig,
  updateGatewayCommissionConfig,
  getOrganizerBuyerFee,
  setOrganizerBuyerFee,
  getOrganizerMpSellerConfigured,
  setOrganizerMpSellerAccessToken,
  clearOrganizerMpSellerAccessToken,
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
  getAuditActorUsersList,
  fetchOrganizerEventsIndex,
  setEventOrganizerId,
  resolveEventCollection,
  allocateUniqueEventSlug,
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
export { createAdminUserAccount } from './createAdminUserAccount';

export { fetchMercadoPagoSellerOAuthUrl } from './mercadopagoOAuth';

export {
  appendAuditLog,
  fetchAuditLogsPage,
  AUDIT_SUMMARY_MAX,
  AUDIT_KIND_LABELS,
} from './auditLog';
export type { AuditLogKind, AuditLogRow } from './auditLog';

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
  partnerCanSellTaquilla,
  listPartnerGrantsForUser,
  listPartnerGrantsForEvent,
  listAllPartnerGrants,
  upsertPartnerGrant,
  deletePartnerGrant,
  getPartnerCandidateUsers,
} from './partnerGrants';
export type { PartnerEventPermissions, PartnerEventGrant } from './partnerGrants';