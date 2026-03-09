import type { UserData } from './types';

// User session key for localStorage
const USER_SESSION_KEY = 'ticket_colombia_user_session';

/**
 * Storage service responsible for localStorage operations
 */

// Save user data to localStorage
export const saveUserSession = (userData: UserData): void => {
  localStorage.setItem(USER_SESSION_KEY, JSON.stringify(userData));
};

// Get session from localStorage
export const getUserSession = (): UserData | null => {
  const sessionData = localStorage.getItem(USER_SESSION_KEY);
  return sessionData ? JSON.parse(sessionData) : null;
};

// Clear session from localStorage
export const clearUserSession = (): void => {
  localStorage.removeItem(USER_SESSION_KEY);
}; 