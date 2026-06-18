import { create } from "zustand";
import Storage from "expo-sqlite/kv-store";
import { createJSONStorage, persist } from "zustand/middleware";

import { BookmarkColor } from "@/enums/quran";

export interface Bookmark {
  surah: number;
  ayah: number;
  page: number;
  color: BookmarkColor;
  createdAt: number;
}

interface BookmarkState {
  bookmarks: Bookmark[];
  // Per-ribbon custom names (e.g. "Revision"). Absent → fall back to the colour's
  // default name. The name follows the ribbon as it moves between ayahs.
  labels: Partial<Record<BookmarkColor, string>>;
  // Each of the 4 ribbon colours is a single mushaf-wide slot, and an ayah holds
  // at most one ribbon. Setting a colour moves that ribbon off any other ayah and
  // replaces whatever ribbon was on this one — the palette itself is the cap.
  setBookmark: (surah: number, ayah: number, page: number, color: BookmarkColor) => void;
  removeBookmark: (surah: number, ayah: number) => void;
  setLabel: (color: BookmarkColor, name: string) => void;
}

export const useBookmarkStore = create<BookmarkState>()(
  persist(
    (set) => ({
      bookmarks: [],
      labels: {},

      setBookmark: (surah, ayah, page, color) =>
        set((prev) => ({
          bookmarks: [
            ...prev.bookmarks.filter(
              (b) => b.color !== color && !(b.surah === surah && b.ayah === ayah)
            ),
            { surah, ayah, page, color, createdAt: Date.now() },
          ],
        })),

      removeBookmark: (surah, ayah) =>
        set((prev) => ({
          bookmarks: prev.bookmarks.filter((b) => !(b.surah === surah && b.ayah === ayah)),
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
      name: "quran-bookmarks",
      storage: createJSONStorage(() => Storage),
    }
  )
);
