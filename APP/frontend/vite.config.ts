import path from 'path';
import fs from 'node:fs';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import basicSsl from '@vitejs/plugin-basic-ssl';

const SW_PLACEHOLDERS = [
  'VITE_FIREBASE_API_KEY',
  'VITE_FIREBASE_AUTH_DOMAIN',
  'VITE_FIREBASE_PROJECT_ID',
  'VITE_FIREBASE_STORAGE_BUCKET',
  'VITE_FIREBASE_MESSAGING_SENDER_ID',
  'VITE_FIREBASE_APP_ID',
  'VITE_FIREBASE_MEASUREMENT_ID',
] as const;

function injectSwEnv(template: string, env: Record<string, string>): string {
  return SW_PLACEHOLDERS.reduce(
    (src, key) => src.replaceAll(`%%${key}%%`, env[key] || ''),
    template,
  );
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, '.', '');
  const swTemplatePath = path.resolve(__dirname, 'public/firebase-messaging-sw.js');

  return {
    server: {
      port: 3000,
      host: '0.0.0.0',
      https: true,
    },
    plugins: [
      react(),
      basicSsl(),
      {
        name: 'inject-firebase-sw-config',
        configureServer(server) {
          server.middlewares.use('/firebase-messaging-sw.js', (_req, res) => {
            const template = fs.readFileSync(swTemplatePath, 'utf-8');
            res.setHeader('Content-Type', 'application/javascript');
            res.setHeader('Service-Worker-Allowed', '/');
            res.end(injectSwEnv(template, env));
          });
        },
        closeBundle() {
          const distSw = path.resolve(__dirname, 'dist/firebase-messaging-sw.js');
          if (fs.existsSync(distSw)) {
            const content = injectSwEnv(fs.readFileSync(distSw, 'utf-8'), env);
            fs.writeFileSync(distSw, content);
          }
        },
      },
    ],
    build: {
      target: 'es2015',
      chunkSizeWarningLimit: 1500,
      rollupOptions: {
        output: {
          // Separa el vendor que CASI NUNCA cambia (firebase, react) en chunks
          // propios y estables: así un cambio de código de la app no invalida la
          // caché del navegador de ~300KB de firebase. Solo se reasignan libs que
          // se cargan SIEMPRE de inicio; las pesadas dinámicas (exceljs, tesseract,
          // html5-qrcode) se dejan a Rollup para preservar su lazy-loading.
          manualChunks(id: string) {
            if (id.includes('node_modules/firebase') || id.includes('node_modules/@firebase')) {
              return 'vendor-firebase';
            }
            if (/node_modules\/(react|react-dom|scheduler|react-router|react-router-dom)\//.test(id)) {
              return 'vendor-react';
            }
            return undefined;
          },
        },
      },
    },
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
      dedupe: ['react', 'react-dom', 'scheduler'],
    },
    optimizeDeps: {
      include: ['react', 'react-dom', 'react-dom/client', 'react-router-dom', 'zustand', 'lucide-react'],
      esbuildOptions: {
        define: {
          global: 'globalThis',
        },
      },
    }
  };
});


