import {
  signInWithEmailAndPassword,
  type Auth,
  type UserCredential,
} from 'firebase/auth';
import { db } from '../firebase';
import { collection, getDocs } from 'firebase/firestore';

export async function resolveEmailFromNameOrEmail(
  nameOrEmail: string,
): Promise<string> {
  if (nameOrEmail.includes('@')) {
    return nameOrEmail;
  }

  const lowerName = nameOrEmail.toLowerCase().trim();
  const usuariosSnap = await getDocs(collection(db, 'usuarios'));

  for (const doc of usuariosSnap.docs) {
    const userData = doc.data();
    const loginNames = userData.loginNames || [];
    if (
      loginNames.some((ln: string) => ln.toLowerCase() === lowerName) ||
      (userData.displayName && userData.displayName.toLowerCase() === lowerName)
    ) {
      return userData.email;
    }
  }

  throw new Error(`Usuario "${nameOrEmail}" no encontrado`);
}

export async function signInWithFlexiblePassword(
  auth: Auth,
  email: string,
  password: string,
): Promise<UserCredential> {
  const base = password.trim();
  const variants = [...new Set([base, base.toUpperCase(), base.toLowerCase()])];

  let lastError: unknown;
  for (const variant of variants) {
    try {
      return await signInWithEmailAndPassword(auth, email, variant);
    } catch (err: unknown) {
      lastError = err;
      const code = (err as { code?: string })?.code;
      if (code !== 'auth/invalid-credential' && code !== 'auth/wrong-password') {
        throw err;
      }
    }
  }
  throw lastError;
}
