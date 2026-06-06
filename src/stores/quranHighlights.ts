import { create } from "zustand";
import Storage from "expo-sqlite/kv-store";
import { createJSONStorage, persist } from "zustand/middleware";

import { HighlightColor } from "@/enums/quran";

export interface Highlight {
  surah: number;
  ayah: number;
  page: number;
  color: HighlightColor;
  createdAt: number;
}

interface HighlightState {
  highlights: Highlight[];
  // Per-colour custom names (e.g. "Memorization"). Absent → fall back to the
  // colour's default name. The 7 colours are shared mushaf-wide, the labels too.
  labels: Partial<Record<HighlightColor, string>>;
  // Tap a colour on an ayah: add it if unhighlighted, switch colour if a
  // different one is set, or clear it if the same colour is tapped again. Unlike
  // bookmarks, any number of ayahs can share a colour.
  toggleHighlight: (surah: number, ayah: number, page: number, color: HighlightColor) => void;
  removeHighlight: (surah: number, ayah: number) => void;
  setLabel: (color: HighlightColor, name: string) => void;
}

export const useHighlightStore = create<HighlightState>()(
  persist(
    (set) => ({
      highlights: [],
      labels: {},

      toggleHighlight: (surah, ayah, page, color) =>
        set((prev) => {
          const existing = prev.highlights.find((h) => h.surah === surah && h.ayah === ayah);
          const rest = prev.highlights.filter((h) => !(h.surah === surah && h.ayah === ayah));
          if (existing?.color === color) return { highlights: rest };
          return { highlights: [...rest, { surah, ayah, page, color, createdAt: Date.now() }] };
        }),

      removeHighlight: (surah, ayah) =>
        set((prev) => ({
          highlights: prev.highlights.filter((h) => !(h.surah === surah && h.ayah === ayah)),
        })),

      setLabel: (color, name) =>
        set((prev) => {
          const trimmed = name.trim();
          const labels = { ...prev.labels };
          if (trimmed) labels[color] = trimmed;
          else delete labels[color];
          return { labels };
        }),
    }),
    {
      name: "quran-highlights",
      storage: createJSONStorage(() => Storage),
    }
  )
);
