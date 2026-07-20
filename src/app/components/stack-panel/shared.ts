import { color, fontFamily, fontSize, space } from '@/app/styles/tokens';
import { oneLineErrorSummary } from '@/app/utils/error-summary';
import type { CSSProperties } from 'react';

export const deskBg = color.deskBg;
export const deskLight = color.deskLight;
export const deskText = color.deskText;
export const deskTextMuted = color.deskTextMuted;
export const deskBorder = color.deskBorder;
export const deskChalk = color.deskChalk;

export const CHALKBOARD_TEXTURE = `url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='c'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='3' stitchTiles='stitch'/%3E%3CfeColorMatrix type='matrix' values='0 0 0 0 0.15 0 0 0 0 0.28 0 0 0 0 0.20 0 0 0 0.08 0'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23c)' opacity='1'/%3E%3C/svg%3E")`;

export const sectionLabelStyle: CSSProperties = {
  fontFamily: fontFamily.serif,
  fontSize: fontSize.base,
  fontWeight: 600,
  color: deskTextMuted,
  marginBottom: space[3],
};

export const chalkStatusFill = {
  pass: '#2d5a3b',
  fail: '#5a2d2d',
  running: '#5a4a2d',
} as const;

export const chalkStatusText = {
  pass: '#b5d6b5',
  fail: '#d6a0a0',
  running: '#d6c4a0',
} as const;

export const gitErrorSummary = oneLineErrorSummary;
