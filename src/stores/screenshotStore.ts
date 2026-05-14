import { create } from "zustand";

export type ScreenshotScreenKey =
  | "prayer-times"
  | "reliable-alarms"
  | "athkar"
  | "qibla"
  | "privacy"
  | "qada"
  | "quran"
  | "athkar-with-audio";

export type ScreenshotState = {
  screen: ScreenshotScreenKey | null;
  locale: "en" | "ar";
  seed: string | null;
  payload: Record<string, unknown> | null;
  setShot: (input: {
    screen: ScreenshotScreenKey;
    locale: "en" | "ar";
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
