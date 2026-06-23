import {
  signInWithEmailAndPassword,
  type Auth,
  type UserCredential,
} from 'firebase/auth';
import { httpsCallable } from 'firebase/functions';
import { functions } from '../firebase';

export async function resolveEmailFromNameOrEmail(
  nameOrEmail: string,
): Promise<string> {
  if (nameOrEmail.includes('@')) {
    return nameOrEmail;
  }

  // La búsqueda por nombre se hace server-side: las reglas de Firestore
  // restringen `list` sobre `usuarios` a admins, y este lookup ocurre
  // ANTES de iniciar sesión (sin auth todavía).
  const resolveLoginEmail = httpsCallable(functions, 'resolveLoginEmail');
  try {
    const result = await resolveLoginEmail({ nameOrEmail });
    return (result.data as { email: string }).email;
  } catch (err) {
    throw new Error(`Usuario "${nameOrEmail}" no encontrado`);
  }
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
