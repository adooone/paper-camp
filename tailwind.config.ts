import type { Config } from 'tailwindcss';
import { paperPreset } from '@dendelion/paper-ui/tailwind';

const config: Config = {
  darkMode: 'class',
  content: ['./src/**/*.{js,ts,jsx,tsx}', './index.html'],
  presets: [paperPreset],
  theme: {
    extend: {
      fontFamily: {
        mono: ['JetBrains Mono', 'Fira Code', 'monospace'],
      },
      fontSize: {
        '3xs': '0.6875rem',
        '2xs': '0.75rem',
        xs: '0.875rem',
        sm: '1rem',
        base: '1.125rem',
        md: '1.25rem',
        lg: '1.5rem',
        xl: '1.875rem',
        '2xl': '2.5rem',
        '3xl': '3.5rem',
      },
      borderRadius: {
        '20': '20px',
        '28': '28px',
      },
      minHeight: {
        // 64px matches the Layout header override in utilities.css.
        page: 'calc(100vh - 64px)',
      },
      maxHeight: {
        page: 'calc(100vh - 64px)',
      },
      keyframes: {
        'pc-spin': {
          to: { transform: 'rotate(360deg)' },
        },
      },
      animation: {
        'pc-spin': 'pc-spin 0.8s linear infinite',
      },
      backgroundImage: {
        chalkboard: `url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='c'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='3' stitchTiles='stitch'/%3E%3CfeColorMatrix type='matrix' values='0 0 0 0 0.15 0 0 0 0 0.28 0 0 0 0 0.20 0 0 0 0.08 0'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23c)' opacity='1'/%3E%3C/svg%3E"), linear-gradient(135deg, #264a3a 0%, #1e3a2d 60%)`,
      },
      colors: {
        desk: {
          bg: '#1e3a2d',
          light: '#264a3a',
          text: '#e8e4d9',
          'text-muted': '#a8b5a0',
          border: 'rgba(200, 210, 195, 0.15)',
          chalk: '#d4e8cb',
        },
        chalk: {
          pass: '#2d5a3b',
          'pass-text': '#b5d6b5',
          fail: '#5a2d2d',
          'fail-text': '#d6a0a0',
          running: '#5a4a2d',
          'running-text': '#d6c4a0',
        },
        state: {
          success: '#6A9B72',
          danger: '#A06060',
        },
      },
    },
  },
  plugins: [],
};

export default config;
