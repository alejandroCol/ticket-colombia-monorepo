import { createUserWithEmailAndPassword, getAuth, signOut } from 'firebase/auth';
import { doc, getFirestore, setDoc, Timestamp } from 'firebase/firestore';
import { secondaryApp } from './firebase';

/**
 * Crea cuenta Firebase Auth + documento `users` con rol USER sin afectar la sesión del super admin.
 * Usa una segunda instancia de la app; el JWT de las escrituras a Firestore es el del usuario recién creado.
 */
export async function createPartnerUserAccount(params: {
  email: string;
  password: string;
  name: string;
  phone?: string;
}): Promise<{ uid: string; email: string }> {
  const email = params.email.trim().toLowerCase();
  if (!email || !/\S+@\S+\.\S+/.test(email)) {
    throw new Error('Ingresa un correo válido.');
  }
  if (!params.password || params.password.length < 6) {
    throw new Error('La contraseña debe tener al menos 6 caracteres.');
  }

  const auth = getAuth(secondaryApp);
  const db = getFirestore(secondaryApp);

  let uid = '';
  try {
    const cred = await createUserWithEmailAndPassword(auth, email, params.password);
    uid = cred.user.uid;
    await setDoc(doc(db, 'users', uid), {
      active: true,
      city: '',
      creation_date: Timestamp.now(),
      email,
      name: (params.name || '').trim() || email.split('@')[0],
      phone: (params.phone || '').trim(),
      profile_url: '',
      role: 'USER',
    });
  } finally {
    await signOut(auth);
  }

  return { uid, email };
}
