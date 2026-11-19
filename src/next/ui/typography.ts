import type { CSSProperties } from 'react';
import { textSize } from './tokens';

export type TextScaleId = 'sm' | 'md' | 'lg' | 'xl';

export const TEXT_SCALES: Record<TextScaleId, { label: string; factor: number }> = {
  sm: { label: 'Small', factor: 0.9 },
  md: { label: 'Default', factor: 1 },
  lg: { label: 'Large', factor: 1.15 },
  xl: { label: 'Larger', factor: 1.3 },
};

export const TEXT_SCALE_ORDER: readonly TextScaleId[] = ['sm', 'md', 'lg', 'xl'];

export type BodyFontId = 'cormorant' | 'kyiv-sans' | 'kyiv-serif';

export type TitleFontId = 'luminari' | 'kyiv-titling' | 'kyiv-serif' | 'kyiv-sans';

export type FontFace = {
  label: string;
  family: string;
  weight: number;
  lineHeight: number;
};

const SERIF_FALLBACK = 'Georgia, serif';
const SANS_FALLBACK = 'ui-sans-serif, system-ui, sans-serif';

export const BODY_FONTS: Record<BodyFontId, FontFace> = {
  cormorant: {
    label: 'Cormorant',
    family: `'Cormorant Garamond', ${SERIF_FALLBACK}`,
    weight: 500,
    lineHeight: 1.3,
  },
  'kyiv-sans': {
    label: 'Kyiv Sans',
    family: `'Kyiv Type Sans', ${SANS_FALLBACK}`,
    weight: 400,
    lineHeight: 1.4,
  },
  'kyiv-serif': {
    label: 'Kyiv Serif',
    family: `'Kyiv Type Serif', ${SERIF_FALLBACK}`,
    weight: 400,
    lineHeight: 1.4,
  },
};

export const TITLE_FONTS: Record<TitleFontId, FontFace> = {
  luminari: {
    label: 'Luminari',
    family: `'Luminari', ${SERIF_FALLBACK}`,
    weight: 400,
    lineHeight: 1.2,
  },
  'kyiv-titling': {
    label: 'Kyiv Titling',
    family: `'Kyiv Type Titling', ${SERIF_FALLBACK}`,
    weight: 700,
    lineHeight: 1.15,
  },
  'kyiv-serif': {
    label: 'Kyiv Serif',
    family: `'Kyiv Type Serif', ${SERIF_FALLBACK}`,
    weight: 900,
    lineHeight: 1.2,
  },
  'kyiv-sans': {
    label: 'Kyiv Sans',
    family: `'Kyiv Type Sans', ${SANS_FALLBACK}`,
    weight: 900,
    lineHeight: 1.2,
  },
};

export type Appearance = {
  textScale: TextScaleId;
  bodyFont: BodyFontId;
  titleFont: TitleFontId;
};

export const DEFAULT_APPEARANCE: Appearance = {
  textScale: 'md',
  bodyFont: 'kyiv-sans',
  titleFont: 'kyiv-serif',
};

const HAND_FAMILY = "'Caveat', cursive";
const MONO_FAMILY = "'JetBrains Mono', 'Fira Code', monospace";

export const isTextScaleId = (value: unknown): value is TextScaleId =>
  typeof value === 'string' && value in TEXT_SCALES;

export const isBodyFontId = (value: unknown): value is BodyFontId =>
  typeof value === 'string' && value in BODY_FONTS;

export const isTitleFontId = (value: unknown): value is TitleFontId =>
  typeof value === 'string' && value in TITLE_FONTS;

export const appearanceVars = (appearance: Appearance): CSSProperties => {
  const scale = TEXT_SCALES[appearance.textScale].factor;
  const body = BODY_FONTS[appearance.bodyFont];
  const title = TITLE_FONTS[appearance.titleFont];
  const textVars = Object.fromEntries(
    Object.entries(textSize).map(([size, px]) => [
      `--next-text-${size}`,
      `${Math.round(px * scale)}px`,
    ]),
  );
  return {
    '--next-text-scale': String(scale),
    '--next-font-body': body.family,
    '--next-font-title': title.family,
    '--next-font-hand': HAND_FAMILY,
    '--next-font-mono': MONO_FAMILY,
    '--next-weight-body': String(body.weight),
    '--next-weight-title': String(title.weight),
    '--next-leading-body': String(body.lineHeight),
    '--next-leading-title': String(title.lineHeight),
    ...textVars,
  } as CSSProperties;
};
