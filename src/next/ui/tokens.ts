import { colors, fontSize, radii } from '@dendelion/folk-ui/tokens';
import type { CSSProperties } from 'react';

const ground = '#ECEAE3';
const kraft = '#C9B79C';
const kraftDeep = '#B5A185';
const slabEdge = '#9C8B6F';

const ROOT_PX = 17;

export const textSize = {
  xs: Math.round(Number.parseFloat(fontSize.xs) * ROOT_PX),
  sm: Math.round(Number.parseFloat(fontSize.sm) * ROOT_PX),
  base: Math.round(Number.parseFloat(fontSize.base) * ROOT_PX),
  md: Math.round(Number.parseFloat(fontSize.md) * ROOT_PX),
  lg: Math.round(Number.parseFloat(fontSize.lg) * ROOT_PX),
  xl: Math.round(Number.parseFloat(fontSize.xl) * ROOT_PX),
  '2xl': Math.round(Number.parseFloat(fontSize['2xl']) * ROOT_PX),
} as const;

export type TextSize = keyof typeof textSize;

const palette = {
  blue: [colors.accentBlue, colors.accentBlueDark, colors.washBlue],
  green: [colors.accentGreen, colors.accentGreenDark, colors.washGreen],
  rose: [colors.accentRose, colors.accentRoseDark, colors.washRose],
  amber: [colors.accentAmber, colors.accentAmberDark, colors.washAmber],
  slate: [colors.accentSlate, colors.accentSlateDark, colors.washSlate],
} as const;

const paletteVars = Object.fromEntries(
  Object.entries(palette).flatMap(([name, [accent, dark, wash]]) => [
    [`--next-accent-${name}`, accent],
    [`--next-accent-${name}-dark`, dark],
    [`--next-wash-${name}`, wash],
  ]),
);

export const tokenVars = {
  '--next-ground': ground,
  '--next-grain': 'url("/img/paper-noise.png")',
  '--next-grain-opacity': '0.3',
  '--next-kraft': kraft,
  '--next-kraft-deep': kraftDeep,
  '--next-slab-edge': slabEdge,
  '--next-base': colors.bgBase,
  '--next-surface': colors.bgSurface,
  '--next-elevated': colors.bgElevated,
  '--next-input': colors.bgInput,
  '--next-ink': colors.textPrimary,
  '--next-ink-soft': colors.textSecondary,
  '--next-ink-faint': colors.textTertiary,
  '--next-stroke': colors.borderDefault,
  '--next-stroke-soft': colors.borderSubtle,
  '--next-stroke-muted': colors.sketchStrokeMuted,
  '--next-stroke-strong': colors.sketchStroke,
  '--next-sketch-ink': colors.sketchInk,
  '--next-canvas-700': colors.canvas700,
  '--next-danger': colors.accentRoseDark,
  '--next-good': colors.accentGreenDark,
  '--next-radius-md': radii.md,
  '--next-radius-lg': radii.lg,
  '--next-radius-xl': radii.xl,
  '--next-radius-full': radii.full,
  ...paletteVars,
} as CSSProperties;
