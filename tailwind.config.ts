import type { Config } from 'tailwindcss';

const config: Config = {
  darkMode: ['class'],
  content: ['./app/**/*.{ts,tsx}', './components/**/*.{ts,tsx}', './hooks/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        background: '#fbf8fc',
        surface: '#ffffff',
        'surface-muted': '#F8FAFC',
        'surface-container': '#efedf0',
        'border-subtle': '#E2E8F0',
        primary: '#031636',
        'primary-container': '#1a2b4c',
        'on-primary': '#ffffff',
        'on-surface': '#1b1b1e',
        'on-surface-variant': '#44474e',
        outline: '#75777f',
        success: '#10B981',
        warning: '#F59E0B',
        danger: '#DC2626',
        finance: '#0D9488',
        legal: '#7C3AED',
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'monospace'],
      },
      borderRadius: {
        lg: '0.5rem',
        xl: '0.75rem',
      },
    },
  },
  plugins: [],
};

export default config;
