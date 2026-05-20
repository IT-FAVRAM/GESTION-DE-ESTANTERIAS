import path from 'path';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import basicSsl from '@vitejs/plugin-basic-ssl';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, '.', '');
  return {
    server: {
      port: 3000,
      host: '0.0.0.0',
      https: true,
    },
    plugins: [react(), basicSsl()],
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
