// Mirror of paper-ui's _tokens.scss values — keep in sync with that upstream source.

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
  diffAddedBg: 'rgba(143, 185, 150, 0.18)',
  diffRemovedBg: 'rgba(201, 139, 139, 0.18)',
} as const;
