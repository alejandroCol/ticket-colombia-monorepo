import { 
  getAuth, 
  signInWithEmailAndPassword, 
  signOut, 
  onAuthStateChanged,
  setPersistence,
  browserLocalPersistence,
  createUserWithEmailAndPassword as firebaseCreateUser,
  sendPasswordResetEmail as firebaseSendPasswordResetEmail,
  EmailAuthProvider,
  reauthenticateWithCredential,
  updatePassword,
} from 'firebase/auth';
import type { AuthError } from 'firebase/auth';
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

function messageForAuthError(err: unknown): string {
  const code = (err as AuthError)?.code;
  switch (code) {
    case 'auth/wrong-password':
    case 'auth/invalid-credential':
      return 'La contraseña actual no es correcta.';
    case 'auth/weak-password':
      return 'La nueva contraseña es demasiado débil. Usa al menos 6 caracteres y combina letras y números.';
    case 'auth/requires-recent-login':
      return 'Por seguridad debes volver a iniciar sesión e intentar de nuevo.';
    case 'auth/too-many-requests':
      return 'Demasiados intentos. Espera unos minutos e intenta de nuevo.';
    case 'auth/network-request-failed':
      return 'Error de red. Comprueba tu conexión.';
    default:
      if (err instanceof Error && err.message) return err.message;
      return 'No se pudo cambiar la contraseña. Intenta de nuevo.';
  }
}

/**
 * Cambia la contraseña del usuario en sesión (solo cuentas email/contraseña).
 * Reautentica con la clave actual antes de aplicar la nueva.
 */
export const changePasswordWithCurrent = async (
  currentPassword: string,
  newPassword: string
): Promise<void> => {
  const user = auth.currentUser;
  const email = user?.email?.trim();
  if (!user || !email) {
    throw new Error(
      'No hay sesión válida o tu cuenta no usa correo y contraseña. Cierra sesión y usa recuperación de clave si aplica.'
    );
  }
  const cur = String(currentPassword ?? '');
  const next = String(newPassword ?? '');
  if (cur.length < 1) {
    throw new Error('Ingresa tu contraseña actual.');
  }
  if (next.length < 6) {
    throw new Error('La nueva contraseña debe tener al menos 6 caracteres.');
  }
  if (next === cur) {
    throw new Error('La nueva contraseña debe ser distinta a la actual.');
  }
  try {
    const credential = EmailAuthProvider.credential(email, cur);
    await reauthenticateWithCredential(user, credential);
    await updatePassword(user, next);
  } catch (e) {
    throw new Error(messageForAuthError(e));
  }
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