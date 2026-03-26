import { 
  getAuth, 
  signInWithEmailAndPassword, 
  signOut, 
  onAuthStateChanged,
  setPersistence,
  browserLocalPersistence,
  createUserWithEmailAndPassword as firebaseCreateUser,
  sendPasswordResetEmail as firebaseSendPasswordResetEmail
} from 'firebase/auth';
import type { UserCredential, User } from 'firebase/auth';
import { app } from './firebase';
import { getUserData, createUserDocument } from './firestore';
import { saveUserSession, clearUserSession } from './storage';
import type { UserData } from './types';
import { Timestamp } from 'firebase/firestore';

// Initialize Firebase Auth
const auth = getAuth(app);

/**
 * Authentication service responsible for handling Firebase Authentication
 */

// Login function
export const loginWithEmailAndPassword = async (
  email: string, 
  password: string
): Promise<UserCredential> => {
  // Asegurar persistencia en localStorage para mantener sesión al cerrar el navegador
  await setPersistence(auth, browserLocalPersistence);
  const userCredential = await signInWithEmailAndPassword(auth, email, password);
  
  // Get user data from Firestore and store in localStorage
  const userData = await getUserData(userCredential.user.uid);
  if (userData) {
    saveUserSession(userData);
  }
  
  return userCredential;
};

// Create new user function
export const createUserWithEmailAndPassword = async (
  email: string,
  password: string,
  displayName: string,
  phone: string
): Promise<UserCredential> => {
  // Create user in Firebase Auth
  const userCredential = await firebaseCreateUser(auth, email, password);
  
  // Create user document in Firestore with role 'USER'
  const userData: UserData = {
    uid: userCredential.user.uid,
    active: true,
    city: "",
    creation_date: Timestamp.now(),
    email: email,
    name: displayName,
    phone: phone,
    profile_url: "",
    role: "USER",
  };
  
  await createUserDocument(userData);
  
  return userCredential;
};

// Send password reset email function
export const sendPasswordResetEmail = async (email: string): Promise<void> => {
  return firebaseSendPasswordResetEmail(auth, email);
};

// Logout function
export const logoutUser = async (): Promise<void> => {
  // Clear the session data first
  clearUserSession();
  // Then sign out from Firebase
  return signOut(auth);
};

// Auth state observer function
export const onAuthStateChange = (callback: (user: User | null) => void) => {
  return onAuthStateChanged(auth, callback);
};

// Get current user
export const getCurrentUser = (): User | null => {
  return auth.currentUser;
};

// Admin roles that can access the admin panel (admin/admin = regular, SUPER_ADMIN = see all events)
const ADMIN_ROLES = ['ADMIN', 'admin', 'SUPER_ADMIN'] as const;

// Check if the user has admin access (ADMIN or SUPER_ADMIN) — excluye PARTNER
export const hasAdminAccess = async (uid: string): Promise<boolean> => {
  try {
    const userData = await getUserData(uid);
    const role = userData?.role;
    return !!(userData && role && ADMIN_ROLES.includes(role as typeof ADMIN_ROLES[number]));
  } catch (error) {
    console.error('Error checking admin access:', error);
    return false;
  }
};

/** Admin de taquilla o partner con acceso al panel (login permitido). */
export const hasPanelAccess = async (uid: string): Promise<boolean> => {
  try {
    const userData = await getUserData(uid);
    const role = userData?.role;
    if (!userData || !role) return false;
    if (ADMIN_ROLES.includes(role as (typeof ADMIN_ROLES)[number])) return true;
    return role === 'PARTNER';
  } catch (error) {
    console.error('Error checking panel access:', error);
    return false;
  }
};

export const isPartnerUserAuth = async (uid: string): Promise<boolean> => {
  try {
    const userData = await getUserData(uid);
    return userData?.role === 'PARTNER';
  } catch {
    return false;
  }
};

// Check if the user is super admin (can see and manage all events)
export const isSuperAdmin = async (uid: string): Promise<boolean> => {
  try {
    const userData = await getUserData(uid);
    return !!(userData && userData.role === 'SUPER_ADMIN');
  } catch (error) {
    console.error('Error checking super admin:', error);
    return false;
  }
};

export { auth }; 