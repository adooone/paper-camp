// Mirror of paper-ui's _tokens.scss values for use in TS/TSX.
// Keep this in sync with the upstream source of truth.

export const fontFamily = {
  serif: "'Luminari', 'Cormorant Garamond', Georgia, serif",
  body: "'Cormorant Garamond', Georgia, serif",
  handwritten: "'Caveat', cursive",
  mono: "'JetBrains Mono', monospace",
} as const;

export const space = {
  1: '0.25rem',
  2: '0.5rem',
  3: '0.75rem',
  4: '1rem',
  5: '1.25rem',
  6: '1.5rem',
  7: '1.75rem',
  8: '2rem',
  10: '2.5rem',
  12: '3rem',
  14: '3.5rem',
  16: '4rem',
} as const;

export const fontSize = {
  '2xs': '0.75rem',
  xs: '0.875rem',
  sm: '1rem',
  base: '1.125rem',
  md: '1.25rem',
  lg: '1.5rem',
  xl: '1.875rem',
  '2xl': '2.5rem',
  '3xl': '3.5rem',
} as const;

export const lineHeight = {
  tight: 1.2,
  snug: 1.35,
  normal: 1.5,
  relaxed: 1.7,
} as const;

export const radius = {
  sm: '8px',
  md: '12px',
  lg: '20px',
  xl: '28px',
  full: '9999px',
} as const;

export const transition = {
  fast: '150ms ease-out',
  base: '200ms ease-out',
  slow: '300ms ease-out',
  panel: 'transform 300ms cubic-bezier(0.4, 0, 0.2, 1)',
} as const;

export const color = {
  textPrimary: '#1A1917',
  // Slightly darker than textPrimary; used specifically for long-form prose
  // bodies (decisions, notes, open questions, repo docs, progress entries).
  textProse: '#1C1B18',
  textSecondary: '#68635C',
  textTertiary: '#A8A399',
  accentAmber: '#D4A373',
  accentAmberDark: '#A67B4F',
  accentGreen: '#8FB996',
  accentGreenDark: '#5E8A66',
  accentRose: '#C98B8B',
  accentRoseDark: '#9E5E5E',
  accentSlate: '#8A9BA8',
  accentSlateDark: '#5E7080',
  deskBg: '#1e3a2d',
  deskLight: '#264a3a',
  deskText: '#e8e4d9',
  deskTextMuted: '#a8b5a0',
  deskBorder: 'rgba(200, 210, 195, 0.15)',
  deskChalk: '#d4e8cb',
} as const;

// paper-ui's Layout header is 48px by default; we override it to 64px (two 32px
// grid cells) in utilities.css. Keep this in sync with that rule.
const headerHeight = '64px';

export const layout = {
  // 224 = 7 × 32, a multiple of the Layout's 32px background grid cell so the
  // sidebar (and the plans Filters card that fills it) sits flush on the grid.
  sidebarWidth: 224,
  stackPanelWidth: 480,
  headerHeight,
  contentGap: space[6],
} as const;
