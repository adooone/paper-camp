import { describe, expect, it } from 'vitest';
import type { StateStorage } from 'zustand/middleware';
import { appearanceVars, DEFAULT_APPEARANCE } from '../ui/typography';
import { APPEARANCE_KEY, createAppearanceStore, readAppearance } from './appearance-slice';

const makeStorage = (initial: Record<string, string> = {}) => {
  const items = new Map(Object.entries(initial));
  const storage: StateStorage = {
    getItem: (key) => items.get(key) ?? null,
    setItem: (key, value) => void items.set(key, value),
    removeItem: (key) => void items.delete(key),
  };
  return { items, storage };
};

const stored = (appearance: unknown) => JSON.stringify({ state: { appearance }, version: 0 });

describe('appearance slice', () => {
  it('starts from the phone setting the user runs', () => {
    const { storage } = makeStorage();
    const store = createAppearanceStore(() => storage);
    expect(store.getState().appearance).toEqual({
      textScale: 'md',
      bodyFont: 'kyiv-sans',
      titleFont: 'kyiv-serif',
    });
  });

  it('persists a change under paper-camp-appearance', () => {
    const { items, storage } = makeStorage();
    createAppearanceStore(() => storage)
      .getState()
      .setAppearance({ textScale: 'lg' });
    expect(JSON.parse(items.get(APPEARANCE_KEY) ?? '{}').state).toEqual({
      appearance: { ...DEFAULT_APPEARANCE, textScale: 'lg' },
    });
  });

  it('restores the stored choice on the next load', () => {
    const { storage } = makeStorage({
      [APPEARANCE_KEY]: stored({ textScale: 'xl', bodyFont: 'cormorant', titleFont: 'luminari' }),
    });
    expect(createAppearanceStore(() => storage).getState().appearance).toEqual({
      textScale: 'xl',
      bodyFont: 'cormorant',
      titleFont: 'luminari',
    });
  });

  it('falls back per field when a stored id is unknown', () => {
    const { storage } = makeStorage({
      [APPEARANCE_KEY]: stored({ textScale: 'huge', bodyFont: 'kyiv-serif' }),
    });
    expect(createAppearanceStore(() => storage).getState().appearance).toEqual({
      ...DEFAULT_APPEARANCE,
      bodyFont: 'kyiv-serif',
    });
  });

  it('reads nothing stored as the defaults', () => {
    expect(readAppearance(undefined)).toEqual(DEFAULT_APPEARANCE);
    expect(readAppearance('kyiv-sans')).toEqual(DEFAULT_APPEARANCE);
  });
});

describe('appearanceVars', () => {
  it('sets the Kyiv faces and the unscaled sizes at Default', () => {
    expect(appearanceVars(DEFAULT_APPEARANCE)).toMatchObject({
      '--next-font-body': "'Kyiv Type Sans', ui-sans-serif, system-ui, sans-serif",
      '--next-font-title': "'Kyiv Type Serif', Georgia, serif",
      '--next-font-hand': "'Caveat', cursive",
      '--next-font-mono': "'JetBrains Mono', 'Fira Code', monospace",
      '--next-weight-body': '400',
      '--next-weight-title': '900',
      '--next-text-scale': '1',
      '--next-text-xs': '13px',
      '--next-text-base': '17px',
      '--next-text-2xl': '32px',
    });
  });

  it('multiplies every size by the chosen scale', () => {
    expect(appearanceVars({ ...DEFAULT_APPEARANCE, textScale: 'lg' })).toMatchObject({
      '--next-text-scale': '1.15',
      '--next-text-xs': '15px',
      '--next-text-base': '20px',
      '--next-text-2xl': '37px',
    });
  });

  it('carries the title face weight and leading', () => {
    expect(appearanceVars({ ...DEFAULT_APPEARANCE, titleFont: 'kyiv-titling' })).toMatchObject({
      '--next-font-title': "'Kyiv Type Titling', Georgia, serif",
      '--next-weight-title': '700',
      '--next-leading-title': '1.15',
    });
  });
});
