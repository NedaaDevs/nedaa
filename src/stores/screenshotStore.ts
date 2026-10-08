import { create } from "zustand";

import type { ScreenshotLocale, ScreenshotScreenKey } from "@/constants/Screenshot";

export type ScreenshotState = {
  screen: ScreenshotScreenKey | null;
  locale: ScreenshotLocale;
  seed: string | null;
  payload: Record<string, unknown> | null;
  setShot: (input: {
    screen: ScreenshotScreenKey;
    locale: ScreenshotLocale;
    seed: string;
    payload: Record<string, unknown>;
  }) => void;
  reset: () => void;
};

export const useScreenshotStore = create<ScreenshotState>((set) => ({
  screen: null,
  locale: "en",
  seed: null,
  payload: null,
  setShot: ({ screen, locale, seed, payload }) => set({ screen, locale, seed, payload }),
  reset: () => set({ screen: null, locale: "en", seed: null, payload: null }),
}));
