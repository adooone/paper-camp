import { create, type StateCreator } from 'zustand';
import { createJSONStorage, persist, type StateStorage } from 'zustand/middleware';
import {
  type Appearance,
  DEFAULT_APPEARANCE,
  isBodyFontId,
  isTextScaleId,
  isTitleFontId,
} from '../ui/typography';

export const APPEARANCE_KEY = 'paper-camp-appearance';

export type AppearanceSlice = {
  appearance: Appearance;
  setAppearance: (patch: Partial<Appearance>) => void;
};

export const createAppearanceSlice: StateCreator<AppearanceSlice> = (set) => ({
  appearance: DEFAULT_APPEARANCE,
  setAppearance: (patch) => set((state) => ({ appearance: { ...state.appearance, ...patch } })),
});

export const readAppearance = (stored: unknown): Appearance => {
  const value = (stored ?? {}) as Partial<Record<keyof Appearance, unknown>>;
  return {
    textScale: isTextScaleId(value.textScale) ? value.textScale : DEFAULT_APPEARANCE.textScale,
    bodyFont: isBodyFontId(value.bodyFont) ? value.bodyFont : DEFAULT_APPEARANCE.bodyFont,
    titleFont: isTitleFontId(value.titleFont) ? value.titleFont : DEFAULT_APPEARANCE.titleFont,
  };
};

export const createAppearanceStore = (storage: () => StateStorage = () => localStorage) =>
  create<AppearanceSlice>()(
    persist(createAppearanceSlice, {
      name: APPEARANCE_KEY,
      storage: createJSONStorage(storage),
      partialize: (state) => ({ appearance: state.appearance }),
      merge: (persisted, current) => ({
        ...current,
        appearance: readAppearance((persisted as Partial<AppearanceSlice> | undefined)?.appearance),
      }),
    }),
  );

export const useAppearanceStore = createAppearanceStore();
