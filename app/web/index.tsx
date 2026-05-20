import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import './index.css';
import AppV3 from './AppV3';

// ─── Orientation lock: tablets → landscape, phones → portrait ──────────────
const isTabletDevice = (): boolean => {
  const ua = navigator.userAgent;
  // iPad (iOS 13+ reporta como Mac con touch)
  const isIPad = /iPad/.test(ua) ||
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  // Android tablet (Android sin "Mobile" en UA)
  const isAndroidTablet = /Android/.test(ua) && !/Mobile/.test(ua);
  // Heurística por tamaño: dispositivo táctil con pantalla >= 768px
  const isLargeTouch = window.matchMedia('(min-width: 768px) and (pointer: coarse)').matches;
  return isIPad || isAndroidTablet || isLargeTouch;
};

const lockOrientationByDevice = async (): Promise<void> => {
  // screen.orientation puede no existir o no soportar lock en algunos navegadores
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const orientation = (screen as any).orientation;
  if (!orientation || typeof orientation.lock !== 'function') return;

  try {
    if (isTabletDevice()) {
      await orientation.lock('landscape');
    } else {
      await orientation.lock('portrait');
    }
  } catch (e) {
    // Falla en navegadores que no son PWA standalone o en iOS Safari (no soporta lock).
    // En esos casos la orientación queda libre y el usuario rota manualmente.
    console.debug('[orientation] lock no soportado:', e);
  }
};

lockOrientationByDevice();

class AppErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { error: Error | null }
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  render() {
    if (this.state.error) {
      return (
        <div style={{
          position: 'fixed', inset: 0, background: '#020617',
          display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
          padding: 24, fontFamily: 'monospace', color: '#f1f5f9',
        }}>
          <div style={{ fontSize: 48, marginBottom: 16 }}>⚠️</div>
          <h1 style={{ fontSize: 20, fontWeight: 900, marginBottom: 8, color: '#ef4444' }}>Error de la aplicación</h1>
          <p style={{ fontSize: 13, color: '#94a3b8', marginBottom: 16, textAlign: 'center', maxWidth: 480 }}>
            {this.state.error.message}
          </p>
          <pre style={{
            fontSize: 10, color: '#64748b', background: '#0f172a',
            padding: 12, borderRadius: 8, maxWidth: 480, overflow: 'auto',
            maxHeight: 200, width: '100%',
          }}>
            {this.state.error.stack}
          </pre>
          <button
            onClick={() => window.location.reload()}
            style={{
              marginTop: 20, padding: '10px 24px', background: '#0891b2',
              color: '#fff', border: 'none', borderRadius: 8,
              fontWeight: 900, fontSize: 14, cursor: 'pointer',
            }}
          >
            Recargar
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error("No se pudo encontrar el elemento raíz para montar la aplicación");
}

const root = ReactDOM.createRoot(rootElement);
root.render(
  <React.StrictMode>
    <AppErrorBoundary>
      <BrowserRouter>
        <AppV3 />
      </BrowserRouter>
    </AppErrorBoundary>
  </React.StrictMode>
);
