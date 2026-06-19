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
      maxWidth: {
        layout: '1044px',
      },
    },
  },
  plugins: [],
};

export default config;
