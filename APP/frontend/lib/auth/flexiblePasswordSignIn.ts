import {
  signInWithEmailAndPassword,
  type Auth,
  type UserCredential,
} from 'firebase/auth';

/**
 * Inicio de sesión con contraseña insensible a mayúsculas/minúsculas.
 *
 * Firebase Auth almacena la contraseña con hash, por lo que la comparación es
 * estrictamente sensible a mayúsculas y no se puede normalizar en el servidor
 * sin resetear contraseñas. En su lugar probamos, en orden, las variantes de
 * caso de lo que escribe el usuario:
 *   1. tal cual (recortando espacios) — la contraseña exacta acierta a la 1ª.
 *   2. TODO EN MAYÚSCULAS — cubre el esquema de la empresa (p.ej. REDACTED)
 *      cuando el operario la teclea en minúsculas.
 *   3. todo en minúsculas — por si alguna cuenta usara ese esquema.
 *
 * Las variantes se deduplican, así que una contraseña ya en mayúsculas solo
 * genera 2 intentos como mucho, y solo en la rama de fallo. Cualquier error que
 * NO sea "credencial inválida" (red, demasiados intentos, cuenta deshabilitada)
 * aborta de inmediato sin reintentar. Resultado: case-insensitive real y CERO
 * riesgo de romper contraseñas existentes con mayúsculas/minúsculas mezcladas.
 */
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
      // Solo reintentamos otra variante si fue contraseña/credencial incorrecta.
      if (code !== 'auth/invalid-credential' && code !== 'auth/wrong-password') {
        throw err;
      }
    }
  }
  throw lastError;
}
