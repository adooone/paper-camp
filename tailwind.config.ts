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
      keyframes: {
        'pc-spin': {
          to: { transform: 'rotate(360deg)' },
        },
      },
      animation: {
        'pc-spin': 'pc-spin 0.8s linear infinite',
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
