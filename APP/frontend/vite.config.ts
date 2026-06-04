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


