import { initializeApp } from 'firebase/app';
import { 
  getAuth, 
  signInWithEmailAndPassword, 
  signOut, 
  onAuthStateChanged
} from 'firebase/auth';
import type { UserCredential, User } from 'firebase/auth';
import { getFirestore, doc, getDoc } from 'firebase/firestore';
import { getStorage, ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { getFunctions } from 'firebase/functions';
import { firebaseConfig } from './firebase-confi';

/**
 * Firebase initialization service
 * Responsible for initializing Firebase and exporting the app instance
 */

// Initialize Firebase
export const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const storage = getStorage(app);
const functions = getFunctions(app);

// User session key for localStorage
const USER_SESSION_KEY = 'ticket_colombia_user_session';

// User data interface
export interface UserData {
  uid: string;
  email: string;
  displayName?: string;
  role?: string;
  [key: string]: string | number | boolean | undefined | null; // More specific index signature
}

// Login function
export const loginWithEmailAndPassword = async (
  email: string, 
  password: string
): Promise<UserCredential> => {
  const userCredential = await signInWithEmailAndPassword(auth, email, password);
  
  // Get user data from Firestore and store in localStorage
  await getUserDataAndStoreSession(userCredential.user.uid);
  
  return userCredential;
};

// Get user data from Firestore
export const getUserData = async (uid: string): Promise<UserData | null> => {
  try {
    const userDocRef = doc(db, 'users', uid);
    const userDoc = await getDoc(userDocRef);
    
    if (userDoc.exists()) {
      return { uid, ...userDoc.data() } as UserData;
    }
    
    // If no user document exists, return basic user data
    const user = auth.currentUser;
    return user ? { 
      uid: user.uid, 
      email: user.email || '',
      displayName: user.displayName || undefined
    } : null;
    
  } catch (error) {
    console.error('Error fetching user data:', error);
    return null;
  }
};

// Get user data and store in localStorage
export const getUserDataAndStoreSession = async (uid: string): Promise<UserData | null> => {
  const userData = await getUserData(uid);
  
  if (userData) {
    // Store in localStorage
    localStorage.setItem(USER_SESSION_KEY, JSON.stringify(userData));
  }
  
  return userData;
};

// Get session from localStorage
export const getSessionFromStorage = (): UserData | null => {
  const sessionData = localStorage.getItem(USER_SESSION_KEY);
  return sessionData ? JSON.parse(sessionData) : null;
};

// Clear session from localStorage
export const clearSession = (): void => {
  localStorage.removeItem(USER_SESSION_KEY);
};

// Logout function
export const logoutUser = async (): Promise<void> => {
  // Clear the session data first
  clearSession();
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

// Check if the user has admin access
export const hasAdminAccess = async (uid: string): Promise<boolean> => {
  try {
    const userData = await getUserData(uid);
    return !!(userData && userData.role === 'ADMIN');
  } catch (error) {
    console.error('Error checking admin access:', error);
    return false;
  }
};

// Upload a file to Firebase Storage
export const uploadFile = async (file: File, path: string): Promise<string> => {
  try {
    const storageRef = ref(storage, path);
    const snapshot = await uploadBytes(storageRef, file);
    const downloadURL = await getDownloadURL(snapshot.ref);
    return downloadURL;
  } catch (error) {
    console.error('Error uploading file:', error);
    throw error;
  }
};

export { auth, db, storage, functions }; 