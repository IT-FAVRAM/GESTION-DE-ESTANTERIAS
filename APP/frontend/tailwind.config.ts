import type { Config } from 'tailwindcss';

const config: Config = {
  darkMode: 'class',
  content: [
    './index.html',
    './index.tsx',
    './AppV3.tsx',
    './components/**/*.{ts,tsx}',
    './hooks/**/*.{ts,tsx}',
    './lib/**/*.{ts,tsx}',
    './domain/**/*.{ts,tsx}',
  ],
  theme: {
    extend: {
      keyframes: {
        fadeIn: {
          from: { opacity: '0' },
          to: { opacity: '1' },
        },
        scaleIn: {
          from: { opacity: '0', transform: 'scale(0.95)' },
          to: { opacity: '1', transform: 'scale(1)' },
        },
        slideUp: {
          from: { opacity: '0', transform: 'translateY(0.75rem)' },
          to: { opacity: '1', transform: 'translateY(0)' },
        },
      },
      animation: {
        'fade-in': 'fadeIn 0.18s ease-out forwards',
        'scale-in': 'scaleIn 0.2s ease-out forwards',
        'slide-up': 'slideUp 0.22s ease-out forwards',
      },
      colors: {
        slate: {
          950: '#020617',
          900: '#0f172a',
          800: '#1e293b',
          50: '#f8fafc',
        },
        cyan: {
          400: '#22d3ee',
          500: '#06b6d4',
          600: '#0891b2',
        },
      },
      screens: {
        xs: '375px',
      },
    },
  },
  plugins: [],
};

export default config;


