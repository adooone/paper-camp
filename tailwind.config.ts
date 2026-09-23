import type { Config } from 'tailwindcss';
import { paperPreset } from '@dendelion/paper-ui/tailwind';
import { color, colors, withAlpha } from '@dendelion/paper-ui/tokens';

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
      backgroundImage: {
        chalkboard: `url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='c'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='3' stitchTiles='stitch'/%3E%3CfeColorMatrix type='matrix' values='0 0 0 0 0.15 0 0 0 0 0.28 0 0 0 0 0.20 0 0 0 0.08 0'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23c)' opacity='1'/%3E%3C/svg%3E"), linear-gradient(135deg, #264a3a 0%, #1e3a2d 60%)`,
      },
      colors: {
        // Mapped onto the --pui-btn-* variables utilities.css declares, so the values
        // have one home and `bg-btn-primary` and paper-ui's Button agree by construction.
        btn: {
          primary: 'var(--pui-btn-primary)',
          'primary-hover': 'var(--pui-btn-primary-hover)',
          'primary-active': 'var(--pui-btn-primary-active)',
          secondary: 'var(--pui-btn-secondary)',
          'secondary-hover': 'var(--pui-btn-secondary-hover)',
          'secondary-active': 'var(--pui-btn-secondary-active)',
        },
        desk: {
          bg: colors.chalkboardSurface,
          light: colors.chalkboardLight,
          text: colors.chalkboardText,
          'text-muted': colors.chalkboardMuted,
          border: colors.chalkboardBorder15,
          chalk: colors.chalkboardChalk,
        },
        chalk: {
          pass: withAlpha(color.chalkPass, 0.16),
          'pass-text': color.chalkPass,
          fail: withAlpha(color.chalkFail, 0.16),
          'fail-text': color.chalkFail,
          running: withAlpha(color.chalkRunning, 0.1),
          'running-text': color.chalkRunning,
        },
        state: {
          success: colors.accentGreenDark,
          danger: colors.accentRoseDark,
        },
      },
    },
  },
  plugins: [],
};

export default config;
