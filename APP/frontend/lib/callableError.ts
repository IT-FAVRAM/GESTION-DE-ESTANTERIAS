/** Extrae mensaje legible de errores de Firebase callable (HttpsError). */
export function parseCallableError(error: unknown): string {
  const e = error as { code?: string; message?: string };
  const raw = e?.message || 'Error desconocido';
  // Formato típico: "FirebaseError: not-found: Articulo no encontrado."
  const withoutPrefix = raw.replace(/^FirebaseError:\s*/i, '').trim();
  const colonIdx = withoutPrefix.indexOf(':');
  if (colonIdx > 0 && colonIdx < 40) {
    const code = withoutPrefix.slice(0, colonIdx).trim();
    const detail = withoutPrefix.slice(colonIdx + 1).trim();
    if (detail) return detail;
    if (code) return code;
  }
  return withoutPrefix || 'Error desconocido';
}


