import React, { useEffect, useRef, useState } from 'react';
import { RefreshCw } from 'lucide-react';

/**
 * AppUpdateNotifier — detecta que se ha desplegado una versión nueva.
 *
 * La app es una SPA que no se recarga sola: una pestaña (o un kiosko que pasa
 * días encendido) seguía ejecutando el código antiguo tras un deploy. Cada build
 * publica `/version.json` con su id; aquí se compara con el id compilado.
 *
 * - Si hay versión nueva: aviso "Actualizar" (recarga inmediata al pulsarlo).
 * - Además se recarga sola cuando el equipo lleva IDLE_MS sin interacción, para
 *   no interrumpir nunca una operación en curso (ubicar, retirar...).
 */

const CHECK_EVERY_MS = 5 * 60 * 1000;
const IDLE_MS = 2 * 60 * 1000;

const AppUpdateNotifier: React.FC = () => {
  const [updateReady, setUpdateReady] = useState(false);
  const lastInteraction = useRef(Date.now());

  // Comprobación periódica de version.json (solo en build de producción).
  useEffect(() => {
    if (import.meta.env.DEV) return;
    let cancelled = false;
    const check = async () => {
      if (!navigator.onLine) return;
      try {
        const res = await fetch(`/version.json?t=${Date.now()}`, { cache: 'no-store' });
        if (!res.ok) return;
        const { build } = (await res.json()) as { build?: string };
        if (!cancelled && build && build !== __BUILD_ID__) setUpdateReady(true);
      } catch {
        /* sin red o respuesta inválida: se reintenta en la siguiente vuelta */
      }
    };
    check();
    const id = window.setInterval(check, CHECK_EVERY_MS);
    const onVisible = () => { if (document.visibilityState === 'visible') check(); };
    document.addEventListener('visibilitychange', onVisible);
    window.addEventListener('online', check);
    return () => {
      cancelled = true;
      window.clearInterval(id);
      document.removeEventListener('visibilitychange', onVisible);
      window.removeEventListener('online', check);
    };
  }, []);

  // Recarga automática al quedar el equipo inactivo con una versión pendiente.
  useEffect(() => {
    if (!updateReady) return;
    const mark = () => { lastInteraction.current = Date.now(); };
    const events = ['pointerdown', 'keydown', 'touchstart', 'wheel'] as const;
    events.forEach((e) => window.addEventListener(e, mark, { passive: true }));
    const id = window.setInterval(() => {
      if (Date.now() - lastInteraction.current >= IDLE_MS) window.location.reload();
    }, 15 * 1000);
    return () => {
      events.forEach((e) => window.removeEventListener(e, mark));
      window.clearInterval(id);
    };
  }, [updateReady]);

  if (!updateReady) return null;

  return (
    <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-[300] flex items-center gap-3 rounded-2xl bg-slate-900 text-white shadow-2xl pl-4 pr-2 py-2 max-w-[calc(100vw-2rem)]">
      <span className="text-sm font-bold">Nueva versión disponible</span>
      <button
        type="button"
        onClick={() => window.location.reload()}
        className="min-h-10 flex items-center gap-2 rounded-xl bg-cyan-500 hover:bg-cyan-400 px-4 text-sm font-black text-slate-950 active:scale-95 transition-all"
      >
        <RefreshCw className="w-4 h-4" aria-hidden />
        Actualizar
      </button>
    </div>
  );
};

export default AppUpdateNotifier;
